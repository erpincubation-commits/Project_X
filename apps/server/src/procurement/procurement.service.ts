import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { rolePermissions, type User, type Permission, type Role, type SupplierInput, type SupplierUpdateInput, type ItemInput, type ItemUpdateInput, type ProcurementQuery, type PurchaseRequestInput, type PurchaseRequestUpdateInput, type SubmitRequestInput, type DecideRequestInput, type PurchaseRequest, type PurchaseRequestLine, type Supplier, type Item, type RecordHistory } from '@erp/contracts';
import { DatabaseService } from '../database/database.service';
import { AuthService, publicUser } from '../auth/auth.service';

type MasterKind = 'supplier' | 'item';
type HistoryKind = MasterKind | 'purchase_request';
const commonMaster = 'id,code,name,active,version,created_at AS "createdAt",updated_at AS "updatedAt"';
const supplierColumns = commonMaster + ',contact_email AS "contactEmail",phone,payment_terms_days AS "paymentTermsDays"';
const itemColumns = commonMaster + ',description,unit';
const requestColumns = `r.id,r.number,r.title,r.justification,r.currency,r.needed_by::text AS "neededBy",r.supplier_id AS "supplierId",r.supplier_code AS "supplierCode",r.supplier_name AS "supplierName",r.supplier_version AS "supplierVersion",
  r.requester_id AS "requesterId",u.email AS "requesterEmail",r.approver_id AS "approverId",a.email AS "approverEmail",r.status,r.submitted_at AS "submittedAt",r.decided_at AS "decidedAt",r.decision_reason AS "decisionReason",r.version,r.created_at AS "createdAt",r.updated_at AS "updatedAt"`;
const requestJoins = 'erp_purchase_requests r JOIN erp_users u ON u.id=r.requester_id LEFT JOIN erp_users a ON a.id=r.approver_id';
const lineColumns = 'id,item_id AS "itemId",item_code AS "itemCode",item_name AS "itemName",item_version AS "itemVersion",unit,quantity::text,estimated_unit_price::text AS "estimatedUnitPrice",(quantity*estimated_unit_price)::text AS "estimatedTotal"';

@Injectable()
export class ProcurementService {
  constructor(private readonly database: DatabaseService, private readonly auth: AuthService) {}
  private async read<T>(work: (client: PoolClient) => Promise<T>) {
    return this.database.transaction(async client => { await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); return work(client); });
  }

  private async actor(client: PoolClient, user: User, permission: Permission) {
    const account = (await client.query<{ id: string; email: string; role: Role; active: boolean }>('SELECT id,email,role,active FROM erp_users WHERE id=$1 FOR SHARE', [user.id])).rows[0];
    if (!account?.active || !rolePermissions[account.role]?.includes(permission)) throw new ForbiddenException('Your access changed. Sign in again.');
    return publicUser(account);
  }
  private async write<T>(user: User, key: string, operation: string, payload: unknown, permission: Permission, work: (client: PoolClient, current: User) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(async client => {
        const current = await this.actor(client, user, permission);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`procurement:${user.id}:${key}`]);
        const previous = (await client.query<{ operation: string; matches: boolean; response: T }>('SELECT operation,payload=$3::jsonb AS matches,response FROM erp_operations WHERE actor_id=$1 AND request_id=$2', [user.id, key, JSON.stringify(payload)])).rows[0];
        if (previous) {
          if (previous.operation !== operation || !previous.matches) throw new ConflictException('This retry key was used for a different operation. Refresh the record before making a new change.');
          return previous.response;
        }
        const result = await work(client, current);
        await client.query('INSERT INTO erp_operations(actor_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)', [user.id,key,operation,JSON.stringify(payload),JSON.stringify(result)]);
        // Ensure first and retried responses have the same JSON representation (including timestamps).
        return JSON.parse(JSON.stringify(result)) as T;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('This code or record version already exists. Refresh and try again.');
      if (['40P01','40001'].includes((error as { code?: string }).code || '')) throw new ConflictException('Another user changed related data. Refresh and retry with the same operation key.');
      throw error;
    }
  }
  private async history(client: PoolClient, user: User, kind: HistoryKind, record: { id: string; version: number }, action: string) {
    await client.query('INSERT INTO erp_record_history(entity_type,entity_id,version,action,actor_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)', [kind,record.id,record.version,action,user.id,JSON.stringify(record)]);
    await this.auth.audit(client,user.id,`${kind}.${action}`,record.id,{ version: record.version },kind);
  }
  private table(kind: MasterKind) { return kind === 'supplier' ? 'erp_suppliers' : 'erp_items'; }
  private columns(kind: MasterKind) { return kind === 'supplier' ? supplierColumns : itemColumns; }
  private visibleSupplier(record: Supplier, user: User) {
    if (user.permissions.includes('masters.history')) return record;
    const { contactEmail, phone, ...publicFields } = record;
    return publicFields;
  }
  async listMasters(kind: MasterKind, user: User, query: ProcurementQuery) {
    const values = [query.search, query.activeOnly === 'true', (query.page-1)*20];
    // strpos treats user input literally instead of interpreting SQL wildcard characters.
    const filter = 'WHERE ($1=\'\' OR strpos(lower(code || \' \' || name),lower($1))>0) AND (NOT $2 OR active)';
    const rows = await this.database.pool.query(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} ${filter} ORDER BY code LIMIT 20 OFFSET $3`,values);
    const count = await this.database.pool.query(`SELECT count(*) FROM ${this.table(kind)} ${filter}`, values.slice(0,2));
    return { items: kind === 'supplier' ? rows.rows.map(row => this.visibleSupplier(row,user)) : rows.rows, total: Number(count.rows[0].count), page: query.page, pageSize: 20 };
  }
  async createMaster(kind: MasterKind, user: User, input: SupplierInput | ItemInput, key: string) {
    return this.write(user,key,`${kind}.create`,input,'masters.manage',async client => {
      const id = randomUUID();
      if (kind === 'supplier') {
        const value = input as SupplierInput;
        await client.query('INSERT INTO erp_suppliers(id,code,name,contact_email,phone,payment_terms_days,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[id,value.code,value.name,value.contactEmail,value.phone,value.paymentTermsDays,value.active,user.id]);
      } else {
        const value = input as ItemInput;
        await client.query('INSERT INTO erp_items(id,code,name,description,unit,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[id,value.code,value.name,value.description,value.unit,value.active,user.id]);
      }
      const record = (await client.query<Supplier | Item>(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} WHERE id=$1`,[id])).rows[0];
      await this.history(client,user,kind,record,'created'); return record;
    });
  }
  async updateMaster(kind: MasterKind, user: User, id: string, input: SupplierUpdateInput | ItemUpdateInput, key: string) {
    return this.write(user,key,`${kind}.update:${id}`,input,'masters.manage',async client => {
      const before = (await client.query(`SELECT version${kind==='supplier'?',privacy_restricted':''} FROM ${this.table(kind)} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if (!before) throw new NotFoundException('Record not found.');
      if (input.active && before.privacy_restricted) throw new ConflictException('Release the supplier privacy restriction before reactivating it.');
      if (before.version !== input.version) throw new ConflictException('This record was changed by another user. Refresh it before editing.');
      if (kind === 'supplier') {
        const value = input as SupplierUpdateInput;
        await client.query('UPDATE erp_suppliers SET name=$2,contact_email=$3,phone=$4,payment_terms_days=$5,active=$6,version=version+1,updated_at=now(),updated_by=$7 WHERE id=$1',[id,value.name,value.contactEmail,value.phone,value.paymentTermsDays,value.active,user.id]);
      } else {
        const value = input as ItemUpdateInput;
        const existing = (await client.query('SELECT unit FROM erp_items WHERE id=$1',[id])).rows[0];
        if(existing.unit!==value.unit && ((await client.query('SELECT 1 FROM erp_stock_entries WHERE item_id=$1 LIMIT 1',[id])).rowCount || (await client.query('SELECT 1 FROM erp_order_lines WHERE item_id=$1 LIMIT 1',[id])).rowCount)) throw new ConflictException('The unit cannot change after stock movements exist. Create a new item for another unit.');
        if(!value.active && (await client.query('SELECT 1 FROM erp_stock_balances WHERE item_id=$1 AND quantity>0 LIMIT 1',[id])).rowCount) throw new ConflictException('Consume or transfer out stock before deactivating this item.');
        await client.query('UPDATE erp_items SET name=$2,description=$3,unit=$4,active=$5,version=version+1,updated_at=now(),updated_by=$6 WHERE id=$1',[id,value.name,value.description,value.unit,value.active,user.id]);
      }
      const record = (await client.query<Supplier | Item>(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} WHERE id=$1`,[id])).rows[0];
      await this.history(client,user,kind,record,'updated'); return record;
    });
  }
  private scope(user: User) { return user.permissions.includes('requests.read.all') ? '($1::uuid IS NOT NULL)' : '(r.requester_id=$1 OR r.approver_id=$1)'; }
  private async request(client: Pick<PoolClient,'query'>, id: string, user?: User): Promise<PurchaseRequest> {
    const record = (await client.query<PurchaseRequest>(`SELECT ${requestColumns} FROM ${requestJoins} WHERE r.id=$2 AND ${user ? this.scope(user) : '($1::uuid IS NULL)'}`,[user?.id || null,id])).rows[0];
    if (!record) throw new NotFoundException('Purchase request not found or unavailable to your account.');
    record.lines = (await client.query<PurchaseRequestLine>(`SELECT ${lineColumns} FROM erp_purchase_request_lines WHERE request_id=$1 ORDER BY line_no`,[id])).rows;
    record.estimatedTotal = (await client.query<{ total: string }>('SELECT coalesce(sum(quantity*estimated_unit_price),0)::text AS total FROM erp_purchase_request_lines WHERE request_id=$1',[id])).rows[0].total;
    return record;
  }
  async getRequest(user: User, id: string) { return this.read(client=>this.request(client,id,user)); }
  async listRequests(user: User, query: ProcurementQuery) {
    const filter = `WHERE ${this.scope(user)} AND ($2='ALL' OR r.status=$2) AND ($3='' OR strpos(lower(r.number || ' ' || r.title),lower($3))>0)`;
    const values = [user.id,query.status,query.search,(query.page-1)*20];
    return this.read(async client=> {
      const rows = await client.query(`SELECT r.id FROM ${requestJoins} ${filter} ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET $4`,values);
      const count = await client.query(`SELECT count(*) FROM ${requestJoins} ${filter}`,values.slice(0,3));
      const items = await Promise.all(rows.rows.map(row => this.request(client,row.id,user)));
      return { items, total:Number(count.rows[0].count), page:query.page, pageSize:20 };
    });
  }
  async approvers(user: User) {
    return (await this.database.pool.query("SELECT id,email FROM erp_users WHERE active AND role='business_approver' AND id<>$1 ORDER BY email",[user.id])).rows;
  }
  private async references(client: PoolClient, input: PurchaseRequestInput) {
    const supplier = input.supplierId ? (await client.query<Supplier>(`SELECT ${supplierColumns} FROM erp_suppliers WHERE id=$1 FOR SHARE`,[input.supplierId])).rows[0] : null;
    if (input.supplierId && !supplier?.active) throw new ConflictException('Select an active supplier.');
    const items = (await client.query<Item>(`SELECT ${itemColumns} FROM erp_items WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE`,[input.lines.map(line=>line.itemId)])).rows;
    if (items.length !== input.lines.length || items.some(item=>!item.active)) throw new ConflictException('Every line must reference an active item.');
    return { supplier, items };
  }
  private async saveLines(client: PoolClient,id: string,input: PurchaseRequestInput,items: Item[]) {
    await client.query('DELETE FROM erp_purchase_request_lines WHERE request_id=$1',[id]);
    for (let index=0;index<input.lines.length;index++) {
      const line=input.lines[index], item=items.find(value=>value.id===line.itemId)!;
      await client.query('INSERT INTO erp_purchase_request_lines(id,request_id,line_no,item_id,item_code,item_name,item_version,unit,quantity,estimated_unit_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),id,index+1,item.id,item.code,item.name,item.version,item.unit,line.quantity,line.estimatedUnitPrice]);
    }
  }
  async createRequest(user: User,input: PurchaseRequestInput,key: string) {
    return this.write(user,key,'request.create',input,'requests.create',async client=> {
      const {supplier,items}=await this.references(client,input), id=randomUUID();
      await client.query('INSERT INTO erp_purchase_requests(id,title,justification,currency,needed_by,supplier_id,supplier_code,supplier_name,supplier_version,requester_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,input.title,input.justification,input.currency,input.neededBy,supplier?.id || null,supplier?.code || null,supplier?.name || null,supplier?.version || null,user.id]);
      await this.saveLines(client,id,input,items);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,'created'); return record;
    });
  }
  private async lockRequest(client: PoolClient,user: User,id: string,version: number) {
    const found = (await client.query(`SELECT r.id FROM erp_purchase_requests r WHERE r.id=$2 AND ${this.scope(user)} FOR UPDATE`,[user.id,id])).rowCount;
    if (!found) throw new NotFoundException('Purchase request not found or unavailable to your account.');
    const record=await this.request(client,id);
    if (record.version!==version) throw new ConflictException('This request has changed. Refresh it and review the latest version.');
    return record;
  }
  async updateRequest(user: User,id: string,input: PurchaseRequestUpdateInput,key: string) {
    return this.write(user,key,`request.update:${id}`,input,'requests.create',async (client,current)=> {
      const before=await this.lockRequest(client,current,id,input.version);
      if (before.requesterId!==user.id) throw new ForbiddenException('Only the requester may edit this request.');
      if (!['DRAFT','REJECTED'].includes(before.status)) throw new ConflictException('Only drafts or rejected requests can be revised.');
      const {supplier,items}=await this.references(client,input);
      await client.query("UPDATE erp_purchase_requests SET title=$2,justification=$3,currency=$4,needed_by=$5,supplier_id=$6,supplier_code=$7,supplier_name=$8,supplier_version=$9,status='DRAFT',approver_id=NULL,submitted_at=NULL,decided_at=NULL,decision_reason=NULL,version=version+1,updated_at=now() WHERE id=$1",[id,input.title,input.justification,input.currency,input.neededBy,supplier?.id || null,supplier?.code || null,supplier?.name || null,supplier?.version || null]);
      await this.saveLines(client,id,input,items);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,before.status==='REJECTED'?'revised':'updated'); return record;
    });
  }
  private async checkActiveReferences(client: PoolClient,record: PurchaseRequest,checkVersions: boolean) {
    if (record.supplierId) {
      const supplier=(await client.query('SELECT active,version FROM erp_suppliers WHERE id=$1 FOR SHARE',[record.supplierId])).rows[0];
      if (!supplier?.active || (checkVersions && supplier.version!==record.supplierVersion)) throw new ConflictException('The supplier changed or is inactive. Revise the draft with current master data before submitting.');
    }
    const items=(await client.query<{id:string;active:boolean;version:number}>('SELECT id,active,version FROM erp_items WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[record.lines.map(line=>line.itemId)])).rows;
    if (!record.lines.length || record.lines.some(line=> { const item=items.find(value=>value.id===line.itemId); return !item?.active || (checkVersions && item.version!==line.itemVersion); })) throw new ConflictException('An item changed or is inactive. Revise the draft with current master data before submitting.');
  }
  async submit(user: User,id: string,input: SubmitRequestInput,key: string) {
    return this.write(user,key,`request.submit:${id}`,input,'requests.create',async (client,current)=> {
      const before=await this.lockRequest(client,current,id,input.version);
      if (before.requesterId!==user.id) throw new ForbiddenException('Only the requester may submit this request.');
      if (before.status!=='DRAFT') throw new ConflictException('Only a draft can be submitted.');
      if (input.approverId===before.requesterId) throw new ForbiddenException('Choose an independent approver. You cannot approve your own request.');
      const approver=(await client.query<{active:boolean;role:Role}>('SELECT active,role FROM erp_users WHERE id=$1 FOR SHARE',[input.approverId])).rows[0];
      if (!approver?.active || !rolePermissions[approver.role].includes('requests.decide')) throw new ConflictException('Select an active business approver.');
      await this.checkActiveReferences(client,before,true);
      await client.query("UPDATE erp_purchase_requests SET status='SUBMITTED',approver_id=$2,submitted_at=now(),version=version+1,updated_at=now() WHERE id=$1",[id,input.approverId]);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,'submitted'); return record;
    });
  }
  async decide(user: User,id: string,input: DecideRequestInput,key: string) {
    return this.write(user,key,`request.decide:${id}`,input,'requests.decide',async (client,current)=> {
      const before=await this.lockRequest(client,current,id,input.version);
      if (before.requesterId===user.id) throw new ForbiddenException('You cannot decide your own purchase request.');
      if (before.approverId!==user.id) throw new ForbiddenException('Only the assigned approver may decide this request.');
      if (before.status!=='SUBMITTED') throw new ConflictException('Only a submitted request can be approved or rejected.');
      if (input.decision==='APPROVED') await this.checkActiveReferences(client,before,false);
      await client.query('UPDATE erp_purchase_requests SET status=$2,decision_reason=$3,decided_at=now(),version=version+1,updated_at=now() WHERE id=$1',[id,input.decision,input.reason]);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,input.decision==='APPROVED'?'approved':'rejected'); return record;
    });
  }
  async recordHistory(user: User,kind: HistoryKind,id: string): Promise<RecordHistory[]> {
    if (kind==='purchase_request') await this.request(this.database.pool,id,user);
    else if (!user.permissions.includes('masters.history')) throw new ForbiddenException('You do not have access to master record history.');
    return (await this.database.pool.query<RecordHistory>('SELECT h.id::text,h.version,h.action,h.actor_id AS "actorId",u.email AS "actorEmail",h.occurred_at AS "occurredAt",h.snapshot FROM erp_record_history h JOIN erp_users u ON u.id=h.actor_id WHERE h.entity_type=$1 AND h.entity_id=$2 ORDER BY h.id DESC LIMIT 200',[kind,id])).rows;
  }
}
