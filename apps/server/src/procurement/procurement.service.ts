import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { rolePermissions, type User, type Permission, type Role, type SupplierInput, type SupplierUpdateInput, type SupplierQualificationInput, type SupplierQualificationDecision, type SupplierQualification, type ItemInput, type ItemUpdateInput, type ProcurementQuery, type PurchaseRequestInput, type PurchaseRequestUpdateInput, type SubmitRequestInput, type DecideRequestInput, type PurchaseRequest, type PurchaseRequestLine, type Supplier, type Item, type RecordHistory, type SupplierQuoteInput, type SupplierQuote, type WithdrawQuoteInput, type RecommendQuoteInput, type QuoteRecommendation, type ApprovalWorkloadRow, type ApprovalWorkload } from '@erp/contracts';
import { DatabaseService } from '../database/database.service';
import { AuthService, publicUser } from '../auth/auth.service';
import { findSupplierDuplicates, reviewSupplierDuplicates } from './supplier-duplicates';

type MasterKind = 'supplier' | 'item';
type HistoryKind = MasterKind | 'purchase_request';
const commonMaster = 'id,code,name,active,version,created_at AS "createdAt",updated_at AS "updatedAt"';
const supplierColumns = commonMaster + `,contact_email AS "contactEmail",phone,payment_terms_days AS "paymentTermsDays",coalesce((SELECT CASE WHEN q.valid_until<current_date THEN 'EXPIRED' ELSE q.status END FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id),'NOT_RECORDED') AS "qualificationStatus",(SELECT q.valid_until::text FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id) AS "qualificationValidUntil"`;
const itemColumns = commonMaster + ',description,unit,item_kind AS "itemKind",service_expense_account_id AS "serviceExpenseAccountId"';
const requestColumns = `r.id,r.number,r.title,r.justification,r.currency,r.needed_by::text AS "neededBy",r.supplier_id AS "supplierId",r.supplier_code AS "supplierCode",r.supplier_name AS "supplierName",r.supplier_version AS "supplierVersion",
  r.requester_id AS "requesterId",u.email AS "requesterEmail",r.approver_id AS "approverId",a.email AS "approverEmail",r.status,r.submitted_at AS "submittedAt",r.decided_at AS "decidedAt",r.decision_reason AS "decisionReason",r.version,r.created_at AS "createdAt",r.updated_at AS "updatedAt"`;
const requestJoins = 'erp_purchase_requests r JOIN erp_users u ON u.id=r.requester_id LEFT JOIN erp_users a ON a.id=r.approver_id';
const lineColumns = 'id,item_id AS "itemId",item_code AS "itemCode",item_name AS "itemName",item_version AS "itemVersion",unit,item_kind AS "itemKind",service_expense_account_id AS "serviceExpenseAccountId",quantity::text,estimated_unit_price::text AS "estimatedUnitPrice",(quantity*estimated_unit_price)::text AS "estimatedTotal"';

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
  private async history(client: PoolClient, user: User, kind: HistoryKind, record: { id: string; version: number }, action: string, context?:unknown) {
    await client.query('INSERT INTO erp_record_history(entity_type,entity_id,version,action,actor_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)', [kind,record.id,record.version,action,user.id,JSON.stringify(context===undefined?record:{...record,context})]);
    await this.auth.audit(client,user.id,`${kind}.${action}`,record.id,{ version: record.version },kind);
  }
  private table(kind: MasterKind) { return kind === 'supplier' ? 'erp_suppliers' : 'erp_items'; }
  private columns(kind: MasterKind) { return kind === 'supplier' ? supplierColumns : itemColumns; }
  private async qualification(client:PoolClient,id:string) {
    const supplier=await client.query('SELECT 1 FROM erp_suppliers WHERE id=$1',[id]);
    if(!supplier.rowCount)throw new NotFoundException('Supplier not found.');
    return (await client.query<SupplierQualification>(`SELECT q.supplier_id AS "supplierId",q.registration_reference AS "registrationReference",q.evidence_reference AS "evidenceReference",q.valid_until::text AS "validUntil",q.status,coalesce(q.valid_until<current_date,false) AS expired,q.review_note AS "reviewNote",s.email AS "submittedByEmail",q.submitted_at AS "submittedAt",r.email AS "reviewedByEmail",q.reviewed_at AS "reviewedAt",q.version FROM erp_supplier_qualifications q JOIN erp_users s ON s.id=q.submitted_by LEFT JOIN erp_users r ON r.id=q.reviewed_by WHERE q.supplier_id=$1`,[id])).rows[0]||null;
  }
  async getSupplierQualification(id:string) {return this.read(async client=>({qualification:await this.qualification(client,id)}));}
  async submitSupplierQualification(user:User,id:string,input:SupplierQualificationInput,key:string) {
    return this.write(user,key,`supplier.qualification.submit:${id}`,input,'masters.manage',async client=>{
      const supplier=(await client.query('SELECT active FROM erp_suppliers WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!supplier)throw new NotFoundException('Supplier not found.');
      if(!supplier.active)throw new ConflictException('Activate the supplier before submitting qualification.');
      if(input.validUntil<new Date().toISOString().slice(0,10))throw new ConflictException('The qualification expiry date has passed.');
      const previous=(await client.query('SELECT version,status FROM erp_supplier_qualifications WHERE supplier_id=$1 FOR UPDATE',[id])).rows[0];
      if(previous?.status==='PENDING')throw new ConflictException('A qualification is already awaiting review.');
      await client.query(`INSERT INTO erp_supplier_qualifications(supplier_id,registration_reference,evidence_reference,valid_until,status,submitted_by) VALUES($1,$2,$3,$4,'PENDING',$5) ON CONFLICT(supplier_id) DO UPDATE SET registration_reference=$2,evidence_reference=$3,valid_until=$4,status='PENDING',review_note=NULL,submitted_by=$5,submitted_at=now(),reviewed_by=NULL,reviewed_at=NULL,version=erp_supplier_qualifications.version+1`,[id,input.registrationReference,input.evidenceReference,input.validUntil,user.id]);
      const record=await this.qualification(client,id);
      await client.query('INSERT INTO erp_supplier_qualification_history(supplier_id,version,action,actor_id,snapshot) VALUES($1,$2,$3,$4,$5)',[id,record!.version,'SUBMITTED',user.id,JSON.stringify(record)]);
      await this.auth.audit(client,user.id,'supplier.qualification.submitted',id,{version:record!.version},'supplier');
      return record;
    });
  }
  async decideSupplierQualification(user:User,id:string,input:SupplierQualificationDecision,key:string) {
    return this.write(user,key,`supplier.qualification.decide:${id}`,input,'users.manage',async client=>{
      if(user.role!=='admin')throw new ForbiddenException('Only an administrator can review supplier qualification.');
      const row=(await client.query('SELECT version,status,submitted_by,valid_until::text AS valid_until FROM erp_supplier_qualifications WHERE supplier_id=$1 FOR UPDATE',[id])).rows[0];
      if(!row)throw new NotFoundException('Supplier qualification not found.');
      if(row.status!=='PENDING'||row.version!==input.version)throw new ConflictException('This qualification changed. Refresh before reviewing.');
      if(row.submitted_by===user.id)throw new ForbiddenException('A different administrator must review this qualification.');
      if(input.approve && row.valid_until<new Date().toISOString().slice(0,10))throw new ConflictException('Expired qualification cannot be approved.');
      const status=input.approve?'APPROVED':'REJECTED';
      await client.query('UPDATE erp_supplier_qualifications SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now(),version=version+1 WHERE supplier_id=$1',[id,status,input.note,user.id]);
      const record=await this.qualification(client,id);
      await client.query('INSERT INTO erp_supplier_qualification_history(supplier_id,version,action,actor_id,snapshot) VALUES($1,$2,$3,$4,$5)',[id,record!.version,status,user.id,JSON.stringify(record)]);
      await this.auth.audit(client,user.id,`supplier.qualification.${status.toLowerCase()}`,id,{version:record!.version},'supplier');
      return record;
    });
  }
  async findSupplierDuplicates(query:{name:string;excludeId?:string;contactEmail?:string;phone?:string}) {
    return this.read(client=>findSupplierDuplicates(client,query,query.excludeId));
  }
  private visibleSupplier(record: Supplier, user: User) {
    if (user.permissions.includes('masters.history')) return record;
    const { contactEmail, phone, qualificationStatus, qualificationValidUntil, ...publicFields } = record;
    return publicFields;
  }
  async listMasters(kind: MasterKind, user: User, query: ProcurementQuery & {contactStatus?:'ALL'|'MISSING_ANY'|'MISSING_BOTH';qualificationStatus?:'ALL'|'NOT_RECORDED'|'PENDING'|'APPROVED'|'REJECTED'|'EXPIRED'|'EXPIRING_30_DAYS'}) {
    if(kind==='supplier'&&query.contactStatus&&query.contactStatus!=='ALL'&&!user.permissions.includes('masters.history'))throw new ForbiddenException('Supplier contact quality is unavailable to your account.');
    if(kind==='supplier'&&query.qualificationStatus&&query.qualificationStatus!=='ALL'&&!user.permissions.includes('masters.history'))throw new ForbiddenException('Supplier qualification is unavailable to your account.');
    const values = [query.search, query.activeOnly === 'true', (query.page-1)*20];
    // strpos treats user input literally instead of interpreting SQL wildcard characters.
    let filter = 'WHERE ($1=\'\' OR strpos(lower(code || \' \' || name),lower($1))>0) AND (NOT $2 OR active)';
    if(kind==='supplier'&&query.contactStatus==='MISSING_ANY')filter+=" AND (btrim(contact_email)='' OR btrim(phone)='')";
    if(kind==='supplier'&&query.contactStatus==='MISSING_BOTH')filter+=" AND (btrim(contact_email)='' AND btrim(phone)='')";
    if(kind==='supplier'&&query.qualificationStatus==='NOT_RECORDED')filter+=' AND NOT EXISTS (SELECT 1 FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id)';
    if(kind==='supplier'&&query.qualificationStatus==='EXPIRING_30_DAYS')filter+=" AND EXISTS (SELECT 1 FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id AND q.status='APPROVED' AND q.valid_until BETWEEN current_date AND current_date+30)";
    if(kind==='supplier'&&query.qualificationStatus==='EXPIRED')filter+=' AND EXISTS (SELECT 1 FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id AND q.valid_until<current_date)';
    if(kind==='supplier'&&['PENDING','APPROVED','REJECTED'].includes(query.qualificationStatus||''))filter+=` AND EXISTS (SELECT 1 FROM erp_supplier_qualifications q WHERE q.supplier_id=erp_suppliers.id AND q.status='${query.qualificationStatus}' AND q.valid_until>=current_date)`;
    const rows = await this.database.pool.query(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} ${filter} ORDER BY code LIMIT 20 OFFSET $3`,values);
    const count = await this.database.pool.query(`SELECT count(*) FROM ${this.table(kind)} ${filter}`, values.slice(0,2));
    return { items: kind === 'supplier' ? rows.rows.map(row => this.visibleSupplier(row,user)) : rows.rows, total: Number(count.rows[0].count), page: query.page, pageSize: 20 };
  }
  async createMaster(kind: MasterKind, user: User, input: SupplierInput | ItemInput, key: string) {
    return this.write(user,key,`${kind}.create`,input,'masters.manage',async (client,current) => {
      const id = randomUUID();
      let duplicateReview: {reference:string;matchCount:number;matchedCodes:string[]}|undefined;
      if (kind === 'supplier') {
        const value = input as SupplierInput;
        const matches=await reviewSupplierDuplicates(client,value);
        if(matches.total)duplicateReview={reference:value.duplicateReviewRef,matchCount:matches.total,matchedCodes:matches.matches.map(match=>match.code)};
        await client.query('INSERT INTO erp_suppliers(id,code,name,contact_email,phone,payment_terms_days,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[id,value.code,value.name,value.contactEmail,value.phone,value.paymentTermsDays,value.active,user.id]);
      } else {
        const value = input as ItemInput;
        if(value.itemKind==='SERVICE'&&!current.permissions.includes('books.read'))throw new ForbiddenException('An administrator must configure service expense accounts.');
        if(value.serviceExpenseAccountId&&!(await client.query("SELECT 1 FROM erp_accounts WHERE id=$1 AND active AND type='EXPENSE' AND control IS NULL FOR SHARE",[value.serviceExpenseAccountId])).rowCount)throw new ConflictException('Choose an active non-control expense account.');
        await client.query('INSERT INTO erp_items(id,code,name,description,unit,active,created_by,updated_by,item_kind,service_expense_account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)',[id,value.code,value.name,value.description,value.unit,value.active,user.id,value.itemKind,value.serviceExpenseAccountId]);
      }
      const record = (await client.query<Supplier | Item>(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} WHERE id=$1`,[id])).rows[0];
      await this.history(client,user,kind,record,'created',duplicateReview?{duplicateReview}:undefined);
      if(duplicateReview)await this.auth.audit(client,user.id,'supplier.duplicate_review',id,duplicateReview,'supplier');
      return record;
    });
  }
  async updateMaster(kind: MasterKind, user: User, id: string, input: SupplierUpdateInput | ItemUpdateInput, key: string) {
    return this.write(user,key,`${kind}.update:${id}`,input,'masters.manage',async (client,current) => {
      const before = (await client.query(`SELECT version${kind==='supplier'?',privacy_restricted,name,contact_email,phone,active':''} FROM ${this.table(kind)} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if (!before) throw new NotFoundException('Record not found.');
      if (input.active && before.privacy_restricted) throw new ConflictException('Release the supplier privacy restriction before reactivating it.');
      if (before.version !== input.version) throw new ConflictException('This record was changed by another user. Refresh it before editing.');
      let duplicateReview: {reference:string;matchCount:number;matchedCodes:string[]}|undefined;
      if (kind === 'supplier') {
        const value = input as SupplierUpdateInput;
        if(value.name!==before.name||value.contactEmail!==before.contact_email||value.phone!==before.phone||(value.active&&!before.active)){
          const matches=await reviewSupplierDuplicates(client,value,id);
          if(matches.total)duplicateReview={reference:value.duplicateReviewRef,matchCount:matches.total,matchedCodes:matches.matches.map(match=>match.code)};
        }
        await client.query('UPDATE erp_suppliers SET name=$2,contact_email=$3,phone=$4,payment_terms_days=$5,active=$6,version=version+1,updated_at=now(),updated_by=$7 WHERE id=$1',[id,value.name,value.contactEmail,value.phone,value.paymentTermsDays,value.active,user.id]);
      } else {
        const value = input as ItemUpdateInput;
        const existing = (await client.query('SELECT unit,item_kind,service_expense_account_id FROM erp_items WHERE id=$1',[id])).rows[0];
        if(existing.item_kind!==value.itemKind)throw new ConflictException('Item type cannot be changed. Create a separate item.');
        if(value.itemKind==='SERVICE'&&value.serviceExpenseAccountId!==existing.service_expense_account_id&&!current.permissions.includes('books.read'))throw new ForbiddenException('An administrator must configure service expense accounts.');
        if(value.serviceExpenseAccountId&&!(await client.query("SELECT 1 FROM erp_accounts WHERE id=$1 AND active AND type='EXPENSE' AND control IS NULL FOR SHARE",[value.serviceExpenseAccountId])).rowCount)throw new ConflictException('Choose an active non-control expense account.');
        if(existing.unit!==value.unit && ((await client.query('SELECT 1 FROM erp_stock_entries WHERE item_id=$1 LIMIT 1',[id])).rowCount || (await client.query('SELECT 1 FROM erp_order_lines WHERE item_id=$1 LIMIT 1',[id])).rowCount)) throw new ConflictException('The unit cannot change after stock movements exist. Create a new item for another unit.');
        if(!value.active && (await client.query('SELECT 1 FROM erp_stock_balances WHERE item_id=$1 AND quantity>0 LIMIT 1',[id])).rowCount) throw new ConflictException('Consume or transfer out stock before deactivating this item.');
        await client.query('UPDATE erp_items SET name=$2,description=$3,unit=$4,active=$5,version=version+1,updated_at=now(),updated_by=$6,service_expense_account_id=$7 WHERE id=$1',[id,value.name,value.description,value.unit,value.active,user.id,value.serviceExpenseAccountId]);
      }
      const record = (await client.query<Supplier | Item>(`SELECT ${this.columns(kind)} FROM ${this.table(kind)} WHERE id=$1`,[id])).rows[0];
      await this.history(client,user,kind,record,'updated',duplicateReview?{duplicateReview}:undefined);
      if(duplicateReview)await this.auth.audit(client,user.id,'supplier.duplicate_review',id,duplicateReview,'supplier');
      return record;
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
  private async quote(client: PoolClient,id:string):Promise<SupplierQuote> {
    const row=(await client.query<SupplierQuote>(`SELECT q.id,q.request_id AS "requestId",q.request_version AS "requestVersion",q.supplier_id AS "supplierId",q.supplier_code AS "supplierCode",q.supplier_name AS "supplierName",q.reference,q.valid_until::text AS "validUntil",coalesce(q.valid_until<current_date,false) AS expired,w.withdrawn_at AS "withdrawnAt",u.email AS "withdrawnByEmail",w.reason AS "withdrawalReason",q.currency,q.created_at AS "createdAt" FROM erp_supplier_quotes q LEFT JOIN erp_supplier_quote_withdrawals w ON w.quote_id=q.id LEFT JOIN erp_users u ON u.id=w.withdrawn_by WHERE q.id=$1`,[id])).rows[0];
    if(!row) throw new NotFoundException('Quotation not found.');
    row.lines=(await client.query('SELECT request_line_id AS "requestLineId",item_code AS "itemCode",item_name AS "itemName",unit,quantity::text,unit_price::text AS "unitPrice" FROM erp_supplier_quote_lines WHERE quote_id=$1 ORDER BY item_code,request_line_id',[id])).rows;
    row.total=(await client.query<{total:string}>('SELECT coalesce(sum(quantity*unit_price),0)::text AS total FROM erp_supplier_quote_lines WHERE quote_id=$1',[id])).rows[0].total;
    return row;
  }
  async listQuotes(requestId:string) {
    return this.read(async client=>{const rows=await client.query('SELECT id FROM erp_supplier_quotes WHERE request_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[requestId]);return Promise.all(rows.rows.map(row=>this.quote(client,row.id)));});
  }
  async listQuoteRecommendations(requestId:string):Promise<QuoteRecommendation[]> {
    return this.read(async client=>(await client.query<QuoteRecommendation>(`SELECT r.id,r.request_id AS "requestId",r.quote_id AS "quoteId",q.supplier_code AS "supplierCode",q.supplier_name AS "supplierName",q.reference,r.reason,u.email AS "recommendedByEmail",r.recommended_at AS "recommendedAt",coalesce(q.valid_until<current_date,false) AS expired,w.withdrawn_at AS "withdrawnAt",s.active AS "supplierActive" FROM erp_quote_recommendations r JOIN erp_supplier_quotes q ON q.id=r.quote_id JOIN erp_users u ON u.id=r.recommended_by JOIN erp_suppliers s ON s.id=q.supplier_id LEFT JOIN erp_supplier_quote_withdrawals w ON w.quote_id=q.id WHERE r.request_id=$1 ORDER BY r.sequence DESC LIMIT 100`,[requestId])).rows);
  }
  async recommendQuote(user:User,id:string,input:RecommendQuoteInput,key:string) {
    return this.write(user,key,`quote.recommend:${id}`,input,'orders.manage',async client=>{
      const initial=(await client.query('SELECT request_id FROM erp_supplier_quotes WHERE id=$1',[id])).rows[0];
      if(!initial)throw new NotFoundException('Quotation not found.');
      const request=await this.lockRequest(client,user,initial.request_id,input.requestVersion);
      if(request.status!=='APPROVED')throw new ConflictException('Only approved requests can be recommended for sourcing.');
      const quote=(await client.query(`SELECT q.id,q.request_id,q.request_version,q.supplier_id,coalesce(q.valid_until<current_date,false) AS expired FROM erp_supplier_quotes q WHERE q.id=$1 FOR UPDATE`,[id])).rows[0];
      if(!quote||quote.request_id!==request.id)throw new ConflictException('Quotation changed. Refresh and retry.');
      if(quote.request_version!==request.version)throw new ConflictException('Quotation does not match the current request version.');
      if(quote.expired||(await client.query('SELECT 1 FROM erp_supplier_quote_withdrawals WHERE quote_id=$1',[id])).rowCount)throw new ConflictException('Choose an unexpired, active quotation.');
      if(!(await client.query('SELECT 1 FROM erp_suppliers WHERE id=$1 AND active FOR SHARE',[quote.supplier_id])).rowCount)throw new ConflictException('Choose a quotation from an active supplier.');
      if((await client.query('SELECT 1 FROM erp_purchase_orders WHERE request_id=$1',[request.id])).rowCount)throw new ConflictException('This request already has an order.');
      const recommendationId=randomUUID();
      await client.query('INSERT INTO erp_quote_recommendations(id,request_id,quote_id,reason,recommended_by) VALUES($1,$2,$3,$4,$5)',[recommendationId,request.id,id,input.reason,user.id]);
      await this.auth.audit(client,user.id,'supplier_quote.recommended',id,{requestId:request.id,recommendationId},'supplier_quote');
      return (await client.query<QuoteRecommendation>(`SELECT r.id,r.request_id AS "requestId",r.quote_id AS "quoteId",q.supplier_code AS "supplierCode",q.supplier_name AS "supplierName",q.reference,r.reason,u.email AS "recommendedByEmail",r.recommended_at AS "recommendedAt",coalesce(q.valid_until<current_date,false) AS expired,w.withdrawn_at AS "withdrawnAt",s.active AS "supplierActive" FROM erp_quote_recommendations r JOIN erp_supplier_quotes q ON q.id=r.quote_id JOIN erp_users u ON u.id=r.recommended_by JOIN erp_suppliers s ON s.id=q.supplier_id LEFT JOIN erp_supplier_quote_withdrawals w ON w.quote_id=q.id WHERE r.id=$1`,[recommendationId])).rows[0];
    });
  }
  async createQuote(user:User,input:SupplierQuoteInput,key:string) {
    return this.write(user,key,'quote.create',input,'orders.manage',async client=>{
      const request=await this.lockRequest(client,user,input.requestId,input.requestVersion);
      if(request.status!=='APPROVED') throw new ConflictException('Select an approved purchase request.');
      const supplier=(await client.query('SELECT id,code,name,active FROM erp_suppliers WHERE id=$1 FOR SHARE',[input.supplierId])).rows[0];
      if(!supplier?.active) throw new ConflictException('Select an active supplier.');
      if(input.lines.length!==request.lines.length || request.lines.some(line=>!input.lines.some(value=>value.requestLineId===line.id))) throw new ConflictException('Provide a price for every request line.');
      const id=randomUUID();
      await client.query('INSERT INTO erp_supplier_quotes(id,request_id,request_version,supplier_id,supplier_code,supplier_name,reference,valid_until,currency,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,request.id,request.version,supplier.id,supplier.code,supplier.name,input.reference,input.validUntil,request.currency,user.id]);
      for(const line of request.lines) await client.query('INSERT INTO erp_supplier_quote_lines(quote_id,request_line_id,item_code,item_name,unit,quantity,unit_price) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,line.id,line.itemCode,line.itemName,line.unit,line.quantity,input.lines.find(value=>value.requestLineId===line.id)!.unitPrice]);
      const record=await this.quote(client,id);await this.auth.audit(client,user.id,'supplier_quote.created',id,{requestId:request.id},'supplier_quote');return record;
    });
  }
  async withdrawQuote(user:User,id:string,input:WithdrawQuoteInput,key:string) {
    return this.write(user,key,`quote.withdraw:${id}`,input,'orders.manage',async client=>{
      const quote=(await client.query('SELECT id,request_id FROM erp_supplier_quotes WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!quote) throw new NotFoundException('Quotation not found.');
      if((await client.query('SELECT 1 FROM erp_supplier_quote_withdrawals WHERE quote_id=$1',[id])).rowCount) throw new ConflictException('This quotation has already been withdrawn.');
      await client.query('INSERT INTO erp_supplier_quote_withdrawals(quote_id,reason,withdrawn_by) VALUES($1,$2,$3)',[id,input.reason,user.id]);
      await this.auth.audit(client,user.id,'supplier_quote.withdrawn',id,{requestId:quote.request_id},'supplier_quote');
      return this.quote(client,id);
    });
  }
  async requestOverview(user: User) {
    const result=await this.database.pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE r.status='DRAFT')::int AS draft,
      count(*) FILTER (WHERE r.status='SUBMITTED')::int AS submitted,
      count(*) FILTER (WHERE r.status='APPROVED')::int AS approved,
      count(*) FILTER (WHERE r.status='REJECTED')::int AS rejected,
      count(*) FILTER (WHERE r.status='SUBMITTED' AND r.approver_id=$1)::int AS "assignedToMe"
      FROM erp_purchase_requests r WHERE ${this.scope(user)}`,[user.id]);
    return result.rows[0];
  }
  async approvalCycles(query:{from:string;to:string;page:number}){
    return this.completedApprovalCycles(query);
  }
  async approvalHolding(query:{from:string;to:string;page:number}){
    return this.read(async c=>{
      const source=`WITH events AS (
        SELECT id,entity_id,version,action,occurred_at,snapshot,
          lead(occurred_at) OVER w AS ended_at,lead(action) OVER w AS end_action
        FROM erp_record_history WHERE entity_type='purchase_request' AND action IN ('submitted','reassigned','approval_handoff','approved','rejected','withdrawn')
        WINDOW w AS (PARTITION BY entity_id ORDER BY version)
      ), intervals AS (
        SELECT * FROM events WHERE action IN ('submitted','reassigned','approval_handoff') AND ended_at IS NOT NULL
          AND (ended_at AT TIME ZONE 'UTC')>=$1::date AND (ended_at AT TIME ZONE 'UTC')<($2::date+1)
      )`;
      const total=Number((await c.query(`${source} SELECT count(*) FROM intervals`,[query.from,query.to])).rows[0].count);
      const items=(await c.query(`${source} SELECT id::text AS "historyId",snapshot->>'number' AS number,snapshot->>'approverEmail' AS "approverEmail",occurred_at AS "startedAt",ended_at AS "endedAt",end_action AS "endAction",round((extract(epoch FROM ended_at-occurred_at)/3600)::numeric,2)::text AS "elapsedHours" FROM intervals ORDER BY ended_at DESC,id DESC LIMIT 20 OFFSET $3`,[query.from,query.to,(query.page-1)*20])).rows;
      return {...query,items,total,pageSize:20};
    });
  }
  private async completedApprovalCycles(query:{from:string;to:string;page:number}){
    return this.read(async c=>{
      const filter="entity_type='purchase_request' AND action IN ('approved','rejected') AND snapshot->>'submittedAt' IS NOT NULL AND snapshot->>'decidedAt' IS NOT NULL AND ((snapshot->>'decidedAt')::timestamptz AT TIME ZONE 'UTC')>=$1::date AND ((snapshot->>'decidedAt')::timestamptz AT TIME ZONE 'UTC')<($2::date+1)";
      const total=Number((await c.query(`SELECT count(*) FROM erp_record_history WHERE ${filter}`,[query.from,query.to])).rows[0].count);
      const items=(await c.query(`SELECT id::text AS "historyId",entity_id AS "requestId",snapshot->>'number' AS number,version,CASE WHEN action='approved' THEN 'APPROVED' ELSE 'REJECTED' END AS decision,snapshot->>'approverEmail' AS "approverEmail",snapshot->>'submittedAt' AS "submittedAt",snapshot->>'decidedAt' AS "decidedAt",round((extract(epoch FROM ((snapshot->>'decidedAt')::timestamptz-(snapshot->>'submittedAt')::timestamptz))/3600)::numeric,2)::text AS "elapsedHours" FROM erp_record_history WHERE ${filter} ORDER BY (snapshot->>'decidedAt')::timestamptz DESC,id DESC LIMIT 20 OFFSET $3`,[query.from,query.to,(query.page-1)*20])).rows;
      return {...query,items,total,pageSize:20};
    });
  }
  async approvalWorkload(query:{page:number}):Promise<ApprovalWorkload> {
    return this.read(async client=> {
      const activity=`WITH activity AS (
        SELECT approver_id,
          count(*) FILTER (WHERE status='SUBMITTED')::int AS pending,
          count(*) FILTER (WHERE status='SUBMITTED' AND submitted_at<=now()-interval '24 hours')::int AS "pending24Hours",
          count(*) FILTER (WHERE status='SUBMITTED' AND submitted_at<=now()-interval '72 hours')::int AS "pending72Hours",
          min(submitted_at) FILTER (WHERE status='SUBMITTED') AS "oldestPendingAt",
          count(*) FILTER (WHERE status IN ('APPROVED','REJECTED') AND decided_at>=now()-interval '30 days')::int AS "decided30Days",
          round(avg(extract(epoch from decided_at-submitted_at)/3600) FILTER (WHERE status IN ('APPROVED','REJECTED') AND decided_at>=now()-interval '30 days'),1)::text AS "averageDecisionHours"
        FROM erp_purchase_requests
        WHERE approver_id IS NOT NULL AND (status='SUBMITTED' OR (status IN ('APPROVED','REJECTED') AND decided_at>=now()-interval '30 days'))
        GROUP BY approver_id
      )`;
      const from=`FROM activity a JOIN erp_users u ON u.id=a.approver_id`;
      const count=await client.query<{total:number}>(`${activity} SELECT count(*)::int AS total ${from}`);
      const rows=await client.query<ApprovalWorkloadRow>(`${activity} SELECT u.id AS "approverId",u.email AS "approverEmail",u.active,a.pending,a."pending24Hours",a."pending72Hours",a."oldestPendingAt",a."decided30Days",a."averageDecisionHours" ${from} ORDER BY a.pending DESC,a."pending72Hours" DESC,u.email,u.id LIMIT 20 OFFSET $1`,[(query.page-1)*20]);
      const asOf=await client.query<{asOf:string}>('SELECT now() AS "asOf"');
      return {items:rows.rows,total:count.rows[0].total,page:query.page,pageSize:20,asOf:asOf.rows[0].asOf};
    });
  }
  async listRequests(user: User, query: ProcurementQuery) {
    const filter = `WHERE ${this.scope(user)} AND ($2='ALL' OR r.status=$2) AND ($3='' OR strpos(lower(r.number || ' ' || r.title),lower($3))>0) AND (NOT $4::boolean OR (r.status='SUBMITTED' AND r.approver_id=$1)) AND ($5::int=0 OR (r.status='SUBMITTED' AND r.submitted_at<=now()-($5::int * interval '1 hour')))`;
    const values = [user.id,query.status,query.search,query.assignedOnly==='true',query.pendingHours,(query.page-1)*20];
    return this.read(async client=> {
      const ordering=query.assignedOnly==='true'?'r.submitted_at ASC,r.id ASC':'r.created_at DESC,r.id DESC';
      const rows = await client.query(`SELECT r.id FROM ${requestJoins} ${filter} ORDER BY ${ordering} LIMIT 20 OFFSET $6`,values);
      const count = await client.query(`SELECT count(*) FROM ${requestJoins} ${filter}`,values.slice(0,5));
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
      await client.query('INSERT INTO erp_purchase_request_lines(id,request_id,line_no,item_id,item_code,item_name,item_version,unit,quantity,estimated_unit_price,item_kind,service_expense_account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[randomUUID(),id,index+1,item.id,item.code,item.name,item.version,item.unit,line.quantity,line.estimatedUnitPrice,item.itemKind,item.serviceExpenseAccountId]);
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
  async withdraw(user: User,id: string,input: {version:number},key: string) {
    return this.write(user,key,`request.withdraw:${id}`,input,'requests.create',async (client,current)=> {
      const before=await this.lockRequest(client,current,id,input.version);
      if (before.requesterId!==user.id) throw new ForbiddenException('Only the requester may withdraw this request.');
      if (before.status!=='SUBMITTED') throw new ConflictException('Only a submitted request can be withdrawn.');
      await client.query("UPDATE erp_purchase_requests SET status='DRAFT',approver_id=NULL,submitted_at=NULL,version=version+1,updated_at=now() WHERE id=$1",[id]);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,'withdrawn'); return record;
    });
  }
  async reassign(user: User,id: string,input: SubmitRequestInput,key: string) {
    return this.write(user,key,`request.reassign:${id}`,input,'requests.create',async (client,current)=> {
      const before=await this.lockRequest(client,current,id,input.version);
      if (before.requesterId!==user.id) throw new ForbiddenException('Only the requester may reassign this request.');
      if (before.status!=='SUBMITTED') throw new ConflictException('Only a submitted request can be reassigned.');
      if (input.approverId===before.requesterId) throw new ForbiddenException('Choose an independent approver.');
      if (input.approverId===before.approverId) throw new ConflictException('Choose a different approver.');
      const approver=(await client.query<{active:boolean;role:Role}>('SELECT active,role FROM erp_users WHERE id=$1 FOR SHARE',[input.approverId])).rows[0];
      if (!approver?.active || !rolePermissions[approver.role].includes('requests.decide')) throw new ConflictException('Select an active business approver.');
      await client.query('UPDATE erp_purchase_requests SET approver_id=$2,version=version+1,updated_at=now() WHERE id=$1',[id,input.approverId]);
      const record=await this.request(client,id); await this.history(client,user,'purchase_request',record,'reassigned'); return record;
    });
  }
  async handoff(user:User,id:string,input:{version:number;approverId:string;reason:string},key:string) {
    return this.write(user,key,`request.handoff:${id}`,input,'requests.decide',async (client,current)=>{
      const before=await this.lockRequest(client,current,id,input.version);
      if(before.status!=='SUBMITTED')throw new ConflictException('Only a submitted request can be handed off.');
      if(before.approverId!==user.id)throw new ForbiddenException('Only the assigned approver may hand off this request.');
      if(input.approverId===before.requesterId)throw new ForbiddenException('Choose an approver independent of the requester.');
      if(input.approverId===user.id)throw new ConflictException('Choose a different approver.');
      const next=(await client.query<{active:boolean;role:Role}>('SELECT active,role FROM erp_users WHERE id=$1 FOR SHARE',[input.approverId])).rows[0];
      if(!next?.active||!rolePermissions[next.role].includes('requests.decide'))throw new ConflictException('Select an active business approver.');
      await client.query('UPDATE erp_purchase_requests SET approver_id=$2,version=version+1,updated_at=now() WHERE id=$1',[id,input.approverId]);
      const record=await this.request(client,id);await this.history(client,user,'purchase_request',record,'approval_handoff',{reason:input.reason,previousApproverId:user.id});return record;
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
