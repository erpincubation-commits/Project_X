import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { rolePermissions, type User, type Role, type Permission, type AccountInput, type AccountUpdateInput, type PeriodInput, type PeriodStateInput, type JournalInput, type JournalUpdateInput, type Journal, type StockMovementInput, type StockMovement, type BooksHistoryKind, type BankReconciliationInput, type BankMatchInput, type BankReconciliation, type StockReconciliation } from '@erp/contracts';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import type { TradeHistoryKind } from '@erp/contracts';

// All monetary arithmetic is exact integer paise. Quantities and unit costs use millionths.
export function units(value:string,scale:number):bigint { const negative=value.startsWith('-'); const [whole,fraction='']=(negative?value.slice(1):value).split('.'); return (negative?-1n:1n)*(BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0'))); }
export function decimal(value:bigint,scale=2):string { const sign=value<0n?'-':'';const absolute=value<0n?-value:value; const base=10n**BigInt(scale);return `${sign}${absolute/base}.${(absolute%base).toString().padStart(scale,'0')}`; }
function rounded(n:bigint,d:bigint) { return (n+d/2n)/d; }
const BOOKS_ID='00000000-0000-4000-8000-000000000001';
const accountCols='id,code,name,type,control,active,version';
const periodCols='id,name,starts_on::text AS "startsOn",ends_on::text AS "endsOn",status,version';
const warehouseCols='id,code,name,active,version';
const journalCols=`j.id,j.number,j.date::text,j.description,j.cash_flow_category AS "cashFlowCategory",j.status,j.source,j.source_id AS "sourceId",j.reversed_of AS "reversedOf",(SELECT id FROM erp_journals WHERE reversed_of=j.id) AS "reversalId",j.version,j.created_by AS "createdBy",j.posted_by AS "postedBy",j.created_at AS "createdAt",j.posted_at AS "postedAt"`;
const movementCols=`m.id,m.sequence::text,m.kind,m.date::text,m.reason,m.item_id AS "itemId",i.code AS "itemCode",m.warehouse_id AS "warehouseId",w.code AS "warehouseCode",m.destination_id AS "destinationId",d.code AS "destinationCode",m.quantity::text,m.value::text,m.journal_id AS "journalId",m.actor_id AS "actorId",m.created_at AS "createdAt"`;
const movementJoins='erp_stock_movements m JOIN erp_items i ON i.id=m.item_id JOIN erp_warehouses w ON w.id=m.warehouse_id LEFT JOIN erp_warehouses d ON d.id=m.destination_id';

@Injectable()
export class BooksService {
 constructor(private readonly database:DatabaseService,private readonly auth:AuthService) {}
 read<T>(work:(client:PoolClient)=>Promise<T>) {return this.database.transaction(async client=>{await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return work(client);});}
 async write<T>(user:User,key:string,operation:string,payload:unknown,permission:Permission,work:(client:PoolClient)=>Promise<T>):Promise<T> {
  try {return await this.database.transaction(async client=>{
   const actor=(await client.query<{active:boolean;role:Role}>('SELECT active,role FROM erp_users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
   if(!actor?.active||!rolePermissions[actor.role]?.includes(permission))throw new ForbiddenException('Your permissions changed. Sign in again.');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`procurement:${user.id}:${key}`]);
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('erp:books',0))");
   const previous=(await client.query('SELECT operation,payload=$3::jsonb AS matches,response FROM erp_operations WHERE actor_id=$1 AND request_id=$2',[user.id,key,JSON.stringify(payload)])).rows[0];
   if(previous){if(previous.operation!==operation||!previous.matches)throw new ConflictException('This retry key belongs to a different operation or payload.');return previous.response as T;}
   const result=await work(client);
   await client.query('INSERT INTO erp_operations(actor_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[user.id,key,operation,JSON.stringify(payload),JSON.stringify(result)]);
   return JSON.parse(JSON.stringify(result)) as T;
  });}catch(error){const code=(error as {code?:string}).code;if(code==='23505')throw new ConflictException('This code, source, reversal or matched bank line already exists.');if(['40P01','40001'].includes(code||''))throw new ConflictException('Related records changed. Refresh and retry with the same key.');if(code==='22003')throw new BadRequestException('The resulting amount or quantity exceeds supported precision.');throw error;}
 }
 async configured(client:PoolClient) {if(!(await client.query('SELECT 1 FROM erp_books')).rowCount)throw new ConflictException('Ask the administrator to initialise INR books and posting mappings first.');}
 async history(client:PoolClient,user:User,kind:BooksHistoryKind|TradeHistoryKind,record:{id:string;version:number},action:string,extra:unknown={}) {
  await client.query('INSERT INTO erp_record_history(entity_type,entity_id,version,action,actor_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[kind,record.id,record.version,action,user.id,JSON.stringify({...record,context:extra})]);
  await this.auth.audit(client,user.id,`${kind}.${action}`,record.id,{version:record.version},kind);
 }
 checkVersion(record:{version:number}|undefined,version:number) {if(!record)throw new NotFoundException('Record not found.');if(record.version!==version)throw new ConflictException('This record changed. Refresh before trying again.');}
 private async overview(client:PoolClient) {
  const settings=(await client.query('SELECT currency,valuation FROM erp_books')).rows[0];
  return {configured:!!settings,currency:settings?.currency||null,valuation:settings?.valuation||null,accounts:(await client.query(`SELECT ${accountCols} FROM erp_accounts ORDER BY code`)).rows,periods:(await client.query(`SELECT ${periodCols} FROM erp_periods ORDER BY starts_on DESC`)).rows,warehouses:(await client.query(`SELECT ${warehouseCols} FROM erp_warehouses ORDER BY code`)).rows};
 }
 getOverview(user:User){return this.read(async client=>{const result=await this.overview(client);return user.permissions.includes('books.read')?result:{...result,accounts:[],periods:[]};});}
 setup(user:User,input:unknown,key:string){return this.write(user,key,'books.setup',input,'books.setup',async client=>{
  if((await client.query('SELECT 1 FROM erp_books')).rowCount)throw new ConflictException('Books are already configured. Currency and valuation policy are fixed.');
  const chart=[['1100','Inventory','ASSET','INVENTORY'],['1110','Bank','ASSET','BANK'],['1120','Recoverable input tax','ASSET','TAX'],['2100','Goods received not invoiced','LIABILITY','GRNI'],['2110','Accounts payable','LIABILITY','AP'],['3100','Opening equity','EQUITY','OPENING'],['5100','Inventory adjustments','EXPENSE','ADJUSTMENT'],['5110','Consumption expense','EXPENSE','CONSUMPTION'],['5120','Purchase price variance','EXPENSE','VARIANCE'],['1130','Accounts receivable','ASSET','AR'],['2120','Output tax','LIABILITY','OUTPUT_TAX'],['4000','Sales revenue','INCOME','SALES']];
  for(const [code,name,type,control]of chart){const record=(await client.query(`INSERT INTO erp_accounts(id,code,name,type,control) VALUES($1,$2,$3,$4,$5) RETURNING ${accountCols}`,[randomUUID(),code,name,type,control])).rows[0];await this.history(client,user,'account',record,'created');}
  await client.query("INSERT INTO erp_books(currency,valuation,created_by) VALUES('INR','MOVING_AVERAGE',$1)",[user.id]);
  const result=await this.overview(client);await this.history(client,user,'books',{id:BOOKS_ID,version:1,...result},'configured');return result;
 });}
 createAccount(user:User,input:AccountInput,key:string){return this.write(user,key,'account.create',input,'books.manage',async client=>{await this.configured(client);const record=(await client.query(`INSERT INTO erp_accounts(id,code,name,type,active) VALUES($1,$2,$3,$4,$5) RETURNING ${accountCols}`,[randomUUID(),input.code,input.name,input.type,input.active])).rows[0];await this.history(client,user,'account',record,'created');return record;});}
 updateAccount(user:User,id:string,input:AccountUpdateInput,key:string){return this.write(user,key,`account.update:${id}`,input,'books.manage',async client=>{
  const before=(await client.query('SELECT * FROM erp_accounts WHERE id=$1 FOR UPDATE',[id])).rows[0];this.checkVersion(before,input.version);
  if(before.control)throw new ConflictException('System posting accounts and their mappings are fixed.');
  const record=(await client.query(`UPDATE erp_accounts SET name=$2,active=$3,version=version+1 WHERE id=$1 RETURNING ${accountCols}`,[id,input.name,input.active])).rows[0];await this.history(client,user,'account',record,'updated');return record;
 });}
 createPeriod(user:User,input:PeriodInput,key:string){return this.write(user,key,'period.create',input,'books.manage',async client=>{
  await this.configured(client);if((await client.query('SELECT 1 FROM erp_periods WHERE starts_on<=$2 AND ends_on>=$1',[input.startsOn,input.endsOn])).rowCount)throw new ConflictException('Accounting periods cannot overlap.');
  const record=(await client.query(`INSERT INTO erp_periods(id,name,starts_on,ends_on) VALUES($1,$2,$3,$4) RETURNING ${periodCols}`,[randomUUID(),input.name,input.startsOn,input.endsOn])).rows[0];await this.history(client,user,'period',record,'created');return record;
 });}
 setPeriod(user:User,id:string,input:PeriodStateInput,key:string){return this.write(user,key,`period.state:${id}`,input,'books.manage',async client=>{
  const before=(await client.query(`SELECT ${periodCols} FROM erp_periods WHERE id=$1 FOR UPDATE`,[id])).rows[0];this.checkVersion(before,input.version);
  if(before.status===input.status)throw new ConflictException('The period is already in this state.');
  if(input.status==='CLOSED'){
   if((await client.query("SELECT 1 FROM erp_journals WHERE status='DRAFT' AND date BETWEEN $1 AND $2",[before.startsOn,before.endsOn])).rowCount)throw new ConflictException('Post or move every draft journal dated in this period before closing.');
   const reconciliation=await this.reconcile(client,before.endsOn);const latest=(await client.query('SELECT greatest(current_date,coalesce(max(date),current_date))::text AS date FROM erp_stock_movements')).rows[0].date;
   if(!reconciliation.balanced||!(await this.reconcile(client,latest)).balanced)throw new ConflictException('Resolve the stock-to-ledger reconciliation differences before closing.');
   if((await client.query('SELECT 1 FROM erp_trade_reconciliation($1) WHERE difference<>0',[before.endsOn])).rowCount)throw new ConflictException('Resolve AP, AR and GRNI reconciliation differences before closing.');
   if((await client.query("SELECT 1 FROM erp_trade_invoices WHERE status='DRAFT' AND date BETWEEN $1 AND $2",[before.startsOn,before.endsOn])).rowCount)throw new ConflictException('Post, revise or void draft supplier/customer invoices in this period before closing.');
  }
  const record=(await client.query(`UPDATE erp_periods SET status=$2,version=version+1 WHERE id=$1 RETURNING ${periodCols}`,[id,input.status])).rows[0];await this.history(client,user,'period',record,input.status==='CLOSED'?'closed':'reopened',{reason:input.reason});return record;
 });}
 async openPeriod(client:PoolClient,date:string) {
  await this.configured(client);
  if(!(await client.query("SELECT 1 FROM erp_periods WHERE $1 BETWEEN starts_on AND ends_on AND status='OPEN'",[date])).rowCount)throw new ConflictException('The posting date must belong to an open accounting period.');
  if((await client.query('SELECT $1::date>current_date AS future',[date])).rows[0].future)throw new BadRequestException('Future-dated posting is not allowed.');
 }
 private async journal(client:PoolClient,id:string):Promise<Journal>{
  const record=(await client.query<Journal>(`SELECT ${journalCols} FROM erp_journals j WHERE j.id=$1`,[id])).rows[0];if(!record)throw new NotFoundException('Journal not found.');
  record.lines=(await client.query('SELECT l.id,l.account_id AS "accountId",a.code AS "accountCode",a.name AS "accountName",l.debit::text,l.credit::text,l.memo FROM erp_journal_lines l JOIN erp_accounts a ON a.id=l.account_id WHERE l.journal_id=$1 ORDER BY l.line_no',[id])).rows;return record;
 }
 getJournal(id:string){return this.read(client=>this.journal(client,id));}
 listJournals(page:number){return this.read(async client=>{const ids=(await client.query('SELECT id FROM erp_journals ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $1',[(page-1)*20])).rows;return {items:await Promise.all(ids.map(row=>this.journal(client,row.id))),page,pageSize:20,total:Number((await client.query('SELECT count(*) FROM erp_journals')).rows[0].count)};});}
 private async validateLines(client:PoolClient,lines:JournalInput['lines'],manual:boolean) {
  let debit=0n,credit=0n;
  for(const line of lines){const d=units(line.debit,2),c=units(line.credit,2);if(d<0n||c<0n||(d===0n)===(c===0n))throw new BadRequestException('Each journal line must have one positive side.');debit+=d;credit+=c;}
  if(lines.length<2||debit===0n||debit!==credit)throw new BadRequestException('Journal debits and credits must balance exactly.');
  const ids=[...new Set(lines.map(l=>l.accountId))].sort();const accounts=(await client.query('SELECT id,active,control FROM erp_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[ids])).rows;
  if(accounts.length!==ids.length||accounts.some(a=>!a.active))throw new ConflictException('Every posting account must exist and be active.');
  if(manual&&accounts.some(a=>['INVENTORY','GRNI','AP','AR','TAX','OUTPUT_TAX'].includes(a.control)))throw new ForbiddenException('Manual journals cannot post to inventory, payable, receivable or tax control accounts.');
 }
 private async saveLines(client:PoolClient,id:string,lines:JournalInput['lines']) {await client.query('DELETE FROM erp_journal_lines WHERE journal_id=$1',[id]);for(let n=0;n<lines.length;n++){const l=lines[n];await client.query('INSERT INTO erp_journal_lines(id,journal_id,line_no,account_id,debit,credit,memo) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,n+1,l.accountId,l.debit,l.credit,l.memo]);}}
 createJournal(user:User,input:JournalInput,key:string){return this.write(user,key,'journal.create',input,'books.manage',async client=>{await this.configured(client);await this.validateLines(client,input.lines,true);const id=randomUUID();await client.query("INSERT INTO erp_journals(id,date,description,source,created_by,cash_flow_category) VALUES($1,$2,$3,'MANUAL',$4,$5)",[id,input.date,input.description,user.id,input.cashFlowCategory||'UNCLASSIFIED']);await this.saveLines(client,id,input.lines);const record=await this.journal(client,id);await this.history(client,user,'journal',record,'created');return record;});}
 updateJournal(user:User,id:string,input:JournalUpdateInput,key:string){return this.write(user,key,`journal.update:${id}`,input,'books.manage',async client=>{const before=await this.journal(client,id);this.checkVersion(before,input.version);if(before.status!=='DRAFT'||before.source!=='MANUAL')throw new ConflictException('Only manual draft journals can be edited.');await this.validateLines(client,input.lines,true);await client.query('UPDATE erp_journals SET date=$2,description=$3,cash_flow_category=$4,version=version+1 WHERE id=$1',[id,input.date,input.description,input.cashFlowCategory||'UNCLASSIFIED']);await this.saveLines(client,id,input.lines);const record=await this.journal(client,id);await this.history(client,user,'journal',record,'updated');return record;});}
 private async post(client:PoolClient,user:User,id:string) {
  const before=await this.journal(client,id);await this.openPeriod(client,before.date);await this.validateLines(client,before.lines,['MANUAL','REVERSAL'].includes(before.source));
  if((await client.query("SELECT 1 FROM erp_bank_reconciliations r JOIN erp_journal_lines l ON l.account_id=r.account_id WHERE l.journal_id=$1 AND r.status='FINALISED' AND $2::date<=r.ends_on",[id,before.date])).rowCount)throw new ConflictException('This bank account is reconciled through this date. Post corrections after the last finalised statement.');
  await client.query("UPDATE erp_journals SET status='POSTED',posted_by=$2,posted_at=now(),version=version+1 WHERE id=$1",[id,user.id]);const record=await this.journal(client,id);await this.history(client,user,'journal',record,'posted');return record;
 }
 postJournal(user:User,id:string,input:{version:number},key:string){return this.write(user,key,`journal.post:${id}`,input,'journals.post',async client=>{const before=await this.journal(client,id);this.checkVersion(before,input.version);if(before.status!=='DRAFT'||before.source!=='MANUAL')throw new ConflictException('Only a manual draft journal can be posted here.');return this.post(client,user,id);});}
 reverseJournal(user:User,id:string,input:{version:number;date:string;reason:string},key:string){return this.write(user,key,`journal.reverse:${id}`,input,'journals.post',async client=>{
  const original=await this.journal(client,id);this.checkVersion(original,input.version);if(original.status!=='POSTED'||original.source!=='MANUAL'||original.reversalId)throw new ConflictException('Only an unreversed posted manual journal can be reversed.');
  if(input.date<original.date)throw new BadRequestException('A reversal cannot precede the original journal date.');const reversalId=randomUUID();
  await client.query("INSERT INTO erp_journals(id,date,description,source,reversed_of,created_by,cash_flow_category) VALUES($1,$2,$3,'REVERSAL',$4,$5,$6)",[reversalId,input.date,input.reason,id,user.id,original.cashFlowCategory]);await this.saveLines(client,reversalId,original.lines.map(l=>({accountId:l.accountId,debit:l.credit,credit:l.debit,memo:l.memo})));return this.post(client,user,reversalId);
 });}
 async postSourceJournal(client:PoolClient,user:User,input:{source:'AP_INVOICE'|'AR_INVOICE'|'AP_PAYMENT'|'AR_COLLECTION'|'STOCK'|'SERVICE_ACCEPTANCE';sourceId:string;date:string;description:string;lines:JournalInput['lines'];cashFlowCategory?:Journal['cashFlowCategory']}){
  const id=randomUUID();await client.query('INSERT INTO erp_journals(id,date,description,source,source_id,created_by,cash_flow_category) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.date,input.description.slice(0,1000),input.source,input.sourceId,user.id,input.cashFlowCategory||'UNCLASSIFIED']);await this.saveLines(client,id,input.lines);return this.post(client,user,id);
 }
 async receiveStock(client:PoolClient,user:User,input:{id:string;receiptLineId:string;itemId:string;warehouseId:string;date:string;reason:string;quantity:string;unitCost:string;value:string}){
  await this.openPeriod(client,input.date);
  if((await client.query('SELECT 1 FROM erp_stock_movements WHERE date>$1 LIMIT 1',[input.date])).rowCount)throw new ConflictException('Receipt inventory date cannot precede the latest stock movement.');
  const item=(await client.query('SELECT active FROM erp_items WHERE id=$1 FOR SHARE',[input.itemId])).rows[0];const warehouse=(await client.query('SELECT active FROM erp_warehouses WHERE id=$1 FOR SHARE',[input.warehouseId])).rows[0];if(!item?.active||!warehouse?.active)throw new ConflictException('Receipt item and warehouse must be active.');
  await client.query('INSERT INTO erp_stock_balances(item_id,warehouse_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[input.itemId,input.warehouseId]);
  const balance=(await client.query('SELECT quantity::text,value::text FROM erp_stock_balances WHERE item_id=$1 AND warehouse_id=$2 FOR UPDATE',[input.itemId,input.warehouseId])).rows[0];const evidence=(await client.query('SELECT coalesce(sum(quantity),0)::text AS quantity,coalesce(sum(value),0)::text AS value FROM erp_stock_entries WHERE item_id=$1 AND warehouse_id=$2',[input.itemId,input.warehouseId])).rows[0];
  if(units(balance.quantity,6)!==units(evidence.quantity,6)||units(balance.value,2)!==units(evidence.value,2))throw new ConflictException('Resolve stock projection differences before receiving.');
  const accounts=(await client.query("SELECT id,control FROM erp_accounts WHERE control IN ('INVENTORY','GRNI')")).rows;const account=(kind:string)=>accounts.find(a=>a.control===kind)!.id;
  const journal=await this.postSourceJournal(client,user,{source:'STOCK',sourceId:input.id,date:input.date,description:input.reason,lines:[{accountId:account('INVENTORY'),debit:input.value,credit:'0',memo:'Accepted goods'},{accountId:account('GRNI'),debit:'0',credit:input.value,memo:'Receipt clearing'}]});
  await client.query("INSERT INTO erp_stock_movements(id,kind,date,reason,item_id,quantity,value,warehouse_id,journal_id,actor_id,receipt_line_id) VALUES($1,'RECEIPT',$2,$3,$4,$5,$6,$7,$8,$9,$10)",[input.id,input.date,input.reason,input.itemId,input.quantity,input.value,input.warehouseId,journal.id,user.id,input.receiptLineId]);
  await client.query('INSERT INTO erp_stock_entries(movement_id,warehouse_id,item_id,quantity,value) VALUES($1,$2,$3,$4,$5)',[input.id,input.warehouseId,input.itemId,input.quantity,input.value]);await client.query('UPDATE erp_stock_balances SET quantity=quantity+$3,value=value+$4,version=version+1 WHERE item_id=$1 AND warehouse_id=$2',[input.itemId,input.warehouseId,input.quantity,input.value]);
  const record=await this.movement(client,input.id);await this.history(client,user,'stock_movement',{...record,version:1},'posted',{receiptLineId:input.receiptLineId});return record;
 }
 createWarehouse(user:User,input:{code:string;name:string;active:boolean},key:string){return this.write(user,key,'warehouse.create',input,'inventory.manage',async client=>{await this.configured(client);const record=(await client.query(`INSERT INTO erp_warehouses(id,code,name,active) VALUES($1,$2,$3,$4) RETURNING ${warehouseCols}`,[randomUUID(),input.code,input.name,input.active])).rows[0];await this.history(client,user,'warehouse',record,'created');return record;});}
 updateWarehouse(user:User,id:string,input:{name:string;active:boolean;version:number},key:string){return this.write(user,key,`warehouse.update:${id}`,input,'inventory.manage',async client=>{const before=(await client.query('SELECT * FROM erp_warehouses WHERE id=$1 FOR UPDATE',[id])).rows[0];this.checkVersion(before,input.version);if(!input.active&&(await client.query('SELECT 1 FROM erp_stock_balances WHERE warehouse_id=$1 AND quantity<>0',[id])).rowCount)throw new ConflictException('Transfer or consume stock before deactivating this warehouse.');const record=(await client.query(`UPDATE erp_warehouses SET name=$2,active=$3,version=version+1 WHERE id=$1 RETURNING ${warehouseCols}`,[id,input.name,input.active])).rows[0];await this.history(client,user,'warehouse',record,'updated');return record;});}
 private async movement(client:PoolClient,id:string):Promise<StockMovement>{const row=(await client.query<StockMovement>(`SELECT ${movementCols} FROM ${movementJoins} WHERE m.id=$1`,[id])).rows[0];if(!row)throw new NotFoundException('Stock movement not found.');return row;}
 listMovements(page:number){return this.read(async client=>({items:(await client.query<StockMovement>(`SELECT ${movementCols} FROM ${movementJoins} ORDER BY m.sequence DESC LIMIT 20 OFFSET $1`,[(page-1)*20])).rows,page,pageSize:20,total:Number((await client.query('SELECT count(*) FROM erp_stock_movements')).rows[0].count)}));}
 postMovement(user:User,input:StockMovementInput,key:string){return this.write(user,key,'stock.post',input,'inventory.manage',async client=>{
  await this.openPeriod(client,input.date);
  if((await client.query('SELECT 1 FROM erp_stock_movements WHERE date>$1 LIMIT 1',[input.date])).rowCount)throw new ConflictException('Inventory cannot be backdated before the latest movement date.');
  const item=(await client.query('SELECT * FROM erp_items WHERE id=$1 FOR SHARE',[input.itemId])).rows[0];if(!item?.active)throw new ConflictException('Choose an active item.');
  const warehouses=[input.warehouseId,...(input.destinationId?[input.destinationId]:[])].sort();const active=(await client.query('SELECT id FROM erp_warehouses WHERE id=ANY($1::uuid[]) AND active ORDER BY id FOR SHARE',[warehouses])).rows;if(active.length!==warehouses.length)throw new ConflictException('Choose active warehouses.');
  for(const warehouse of warehouses)await client.query('INSERT INTO erp_stock_balances(item_id,warehouse_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[input.itemId,warehouse]);
  const balances=(await client.query('SELECT warehouse_id,quantity::text,value::text,version FROM erp_stock_balances WHERE item_id=$1 AND warehouse_id=ANY($2::uuid[]) ORDER BY warehouse_id FOR UPDATE',[input.itemId,warehouses])).rows;
  const evidence=(await client.query('SELECT warehouse_id,sum(quantity)::text AS quantity,sum(value)::text AS value FROM erp_stock_entries WHERE item_id=$1 AND warehouse_id=ANY($2::uuid[]) GROUP BY warehouse_id',[input.itemId,warehouses])).rows;
  for(const balance of balances){const saved=evidence.find(row=>row.warehouse_id===balance.warehouse_id);if(units(balance.quantity,6)!==units(saved?.quantity||'0',6)||units(balance.value,2)!==units(saved?.value||'0',2))throw new ConflictException('Stock projections differ from immutable movement history. Resolve reconciliation before posting.');}
  const source=balances.find(row=>row.warehouse_id===input.warehouseId)!;
  if(input.version!==null)this.checkVersion(source,input.version);
  if(['COUNT','DECREASE','CONSUME','TRANSFER'].includes(input.kind)&&input.version===null)throw new BadRequestException('Refresh valuation and provide the current source stock version.');
  if(input.kind==='OPENING'&&(await client.query('SELECT 1 FROM erp_stock_entries WHERE item_id=$1 AND warehouse_id=$2',[input.itemId,input.warehouseId])).rowCount)throw new ConflictException('Opening stock is allowed only before any movement for this item and warehouse.');
  const oldQuantity=units(source.quantity,6),oldValue=units(source.value,2),entered=units(input.quantity,6);
  const delta=input.kind==='COUNT'?entered-oldQuantity:entered;
  if(delta===0n)throw new BadRequestException('The physical count agrees with stock; no adjustment is needed.');
  const incoming=input.kind==='OPENING'||input.kind==='INCREASE'||(input.kind==='COUNT'&&delta>0n);
  const quantity=delta<0n?-delta:delta;
  if(!incoming&&quantity>oldQuantity)throw new ConflictException('Insufficient stock. Negative stock is blocked.');
  const value=incoming?rounded(quantity*units(input.unitCost,6)*100n,1000000000000n):(quantity===oldQuantity?oldValue:rounded(quantity*oldValue,oldQuantity));
  if(incoming&&value<=0n)throw new BadRequestException('Inbound stock value must round to at least one paise.');
  const id=randomUUID();const entries=[{warehouseId:input.warehouseId,quantity:incoming?quantity:-quantity,value:incoming?value:-value}];
  if(input.kind==='TRANSFER')entries.push({warehouseId:input.destinationId!,quantity,value});
  let journalId:string|null=null;
  if(value>0n){const controls=(await client.query('SELECT id,control FROM erp_accounts WHERE control IS NOT NULL')).rows;const account=(control:string)=>controls.find(a=>a.control===control)!.id;
   const contra=input.kind==='OPENING'?'OPENING':input.kind==='CONSUME'?'CONSUMPTION':'ADJUSTMENT';const inventory=account('INVENTORY');const other=input.kind==='TRANSFER'?inventory:account(contra);journalId=randomUUID();
   await client.query("INSERT INTO erp_journals(id,date,description,source,source_id,created_by) VALUES($1,$2,$3,'STOCK',$4,$5)",[journalId,input.date,input.reason,id,user.id]);
   const debit=incoming||input.kind==='TRANSFER'?inventory:other,credit=incoming||input.kind==='TRANSFER'?other:inventory;
   await this.saveLines(client,journalId,[{accountId:debit,debit:decimal(value),credit:'0',memo:input.kind==='TRANSFER'?'Destination warehouse':'Stock movement'},{accountId:credit,debit:'0',credit:decimal(value),memo:input.kind==='TRANSFER'?'Source warehouse':'Stock movement'}]);await this.post(client,user,journalId);
  }
  await client.query('INSERT INTO erp_stock_movements(id,kind,date,reason,item_id,quantity,value,warehouse_id,destination_id,journal_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,input.kind,input.date,input.reason,input.itemId,decimal(quantity,6),decimal(value),input.warehouseId,input.destinationId,journalId,user.id]);
  for(const entry of entries){await client.query('INSERT INTO erp_stock_entries(movement_id,warehouse_id,item_id,quantity,value) VALUES($1,$2,$3,$4,$5)',[id,entry.warehouseId,input.itemId,decimal(entry.quantity,6),decimal(entry.value)]);await client.query('UPDATE erp_stock_balances SET quantity=quantity+$3,value=value+$4,version=version+1 WHERE item_id=$1 AND warehouse_id=$2',[input.itemId,entry.warehouseId,decimal(entry.quantity,6),decimal(entry.value)]);}
  const record=await this.movement(client,id);await this.history(client,user,'stock_movement',{...record,version:1},'posted',{enteredQuantity:input.quantity,unitCost:input.unitCost,sourceVersion:input.version});return record;
 });}
 private async reconcile(client:PoolClient,date:string):Promise<StockReconciliation>{
  await this.configured(client);
  const current=!(await client.query('SELECT 1 FROM erp_stock_movements WHERE date>$1 LIMIT 1',[date])).rowCount;
  const rows=(await client.query(`WITH amounts AS (SELECT e.item_id,e.warehouse_id,sum(e.quantity) AS quantity,sum(e.value) AS value FROM erp_stock_entries e JOIN erp_stock_movements m ON m.id=e.movement_id WHERE m.date<=$1 GROUP BY e.item_id,e.warehouse_id)
   SELECT coalesce(b.item_id,a.item_id) AS "itemId",i.code AS "itemCode",i.name AS "itemName",coalesce(b.warehouse_id,a.warehouse_id) AS "warehouseId",w.code AS "warehouseCode",coalesce(a.quantity,0)::text AS quantity,coalesce(a.value,0)::text AS value,
   CASE WHEN coalesce(a.quantity,0)=0 THEN '0' ELSE round(a.value/a.quantity,6)::text END AS "averageCost",CASE WHEN $2 THEN b.version ELSE NULL END AS version,
   CASE WHEN $2 THEN b.quantity::text ELSE NULL END AS "projectionQuantity",CASE WHEN $2 THEN b.value::text ELSE NULL END AS "projectionValue",CASE WHEN $2 THEN coalesce(b.quantity=coalesce(a.quantity,0) AND b.value=coalesce(a.value,0),false) ELSE NULL END AS "projectionMatches"
   FROM erp_stock_balances b FULL JOIN amounts a ON a.item_id=b.item_id AND a.warehouse_id=b.warehouse_id JOIN erp_items i ON i.id=coalesce(b.item_id,a.item_id) JOIN erp_warehouses w ON w.id=coalesce(b.warehouse_id,a.warehouse_id) ORDER BY i.code,w.code`,[date,current])).rows;
  const stock=rows.reduce((sum,row)=>sum+units(row.value,2),0n);
  const ledger=(await client.query("SELECT coalesce(sum(l.debit-l.credit),0)::text AS value FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id JOIN erp_accounts a ON a.id=l.account_id WHERE j.status='POSTED' AND j.date<=$1 AND a.control='INVENTORY'",[date])).rows[0].value;
  const difference=stock-units(ledger,2);return {date,currency:'INR',stockValue:decimal(stock),ledgerValue:ledger,difference:decimal(difference),balanced:difference===0n&&rows.every(row=>row.projectionMatches!==false),rows};
 }
 stockReconciliation(date:string){return this.read(client=>this.reconcile(client,date));}
 trialBalance(date:string){return this.read(async client=>{await this.configured(client);const accounts=(await client.query(`SELECT a.id,a.code,a.name,a.type,a.control,a.active,a.version,coalesce(sum(l.debit) FILTER(WHERE j.status='POSTED' AND j.date<=$1),0)::text AS debit,coalesce(sum(l.credit) FILTER(WHERE j.status='POSTED' AND j.date<=$1),0)::text AS credit,coalesce(sum(l.debit-l.credit) FILTER(WHERE j.status='POSTED' AND j.date<=$1),0)::text AS balance FROM erp_accounts a LEFT JOIN erp_journal_lines l ON l.account_id=a.id LEFT JOIN erp_journals j ON j.id=l.journal_id GROUP BY a.id ORDER BY a.code`,[date])).rows;const debit=accounts.reduce((v,a)=>v+units(a.debit,2),0n),credit=accounts.reduce((v,a)=>v+units(a.credit,2),0n);return {date,currency:'INR',accounts,debit:decimal(debit),credit:decimal(credit),balanced:debit===credit};});}
 private async bank(client:PoolClient,id:string):Promise<BankReconciliation>{
  const record=(await client.query<BankReconciliation>('SELECT id,account_id AS "accountId",starts_on::text AS "startsOn",ends_on::text AS "endsOn",opening::text,closing::text,status,version FROM erp_bank_reconciliations WHERE id=$1',[id])).rows[0];if(!record)throw new NotFoundException('Bank reconciliation not found.');
  record.lines=(await client.query('SELECT id,date::text,reference,amount::text,journal_line_id AS "journalLineId" FROM erp_bank_statement_lines WHERE reconciliation_id=$1 ORDER BY date,id',[id])).rows;
  record.ledgerLines=(await client.query(`SELECT l.id,j.id AS "journalId",j.number,j.date::text,(l.debit-l.credit)::text AS amount,EXISTS(SELECT 1 FROM erp_bank_statement_lines s WHERE s.journal_line_id=l.id) AS matched FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id WHERE l.account_id=$1 AND j.status='POSTED' AND j.date<=$3 AND NOT EXISTS(SELECT 1 FROM erp_bank_statement_lines s JOIN erp_bank_reconciliations r ON r.id=s.reconciliation_id WHERE s.journal_line_id=l.id AND r.status='FINALISED' AND r.ends_on<$2) ORDER BY j.date,j.number,l.line_no`,[record.accountId,record.startsOn,record.endsOn])).rows;
  const sums=(await client.query("SELECT coalesce(sum(l.debit-l.credit) FILTER(WHERE j.date<$2),0)::text AS opening,coalesce(sum(l.debit-l.credit),0)::text AS closing FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id WHERE l.account_id=$1 AND j.status='POSTED' AND j.date<=$3",[record.accountId,record.startsOn,record.endsOn])).rows[0];record.ledgerOpening=sums.opening;record.ledgerClosing=sums.closing;
  record.statementCalculatedClosing=decimal(record.lines.reduce((value,l)=>value+units(l.amount,2),units(record.opening,2)));
  const outstanding=(await client.query(`SELECT coalesce(sum(l.debit-l.credit),0)::text AS value FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id WHERE l.account_id=$1 AND j.status='POSTED' AND j.date<=$2 AND NOT EXISTS(SELECT 1 FROM erp_bank_statement_lines s JOIN erp_bank_reconciliations r ON r.id=s.reconciliation_id WHERE s.journal_line_id=l.id AND (r.id=$3 OR (r.status='FINALISED' AND r.ends_on<=$2)))`,[record.accountId,record.endsOn,id])).rows[0].value;
  const priorOutstanding=(await client.query(`SELECT coalesce(sum(l.debit-l.credit),0)::text AS value FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id WHERE l.account_id=$1 AND j.status='POSTED' AND j.date<$2 AND NOT EXISTS(SELECT 1 FROM erp_bank_statement_lines s JOIN erp_bank_reconciliations r ON r.id=s.reconciliation_id WHERE s.journal_line_id=l.id AND r.status='FINALISED' AND r.ends_on<$2)`,[record.accountId,record.startsOn])).rows[0].value;
  record.outstanding=outstanding;record.adjustedClosing=decimal(units(record.closing,2)+units(outstanding,2));record.expectedOpening=decimal(units(record.ledgerOpening,2)-units(priorOutstanding,2));
  const previous=(await client.query("SELECT closing::text,(ends_on+1)::text AS next FROM erp_bank_reconciliations WHERE account_id=$1 AND status='FINALISED' AND ends_on<$2 ORDER BY ends_on DESC LIMIT 1",[record.accountId,record.startsOn])).rows[0];
  record.ready=record.lines.every(l=>l.journalLineId!==null)&&units(record.statementCalculatedClosing,2)===units(record.closing,2)&&units(record.opening,2)===units(record.expectedOpening,2)&&units(record.adjustedClosing,2)===units(record.ledgerClosing,2)&&(!previous||(previous.next===record.startsOn&&units(previous.closing,2)===units(record.opening,2)));return record;
 }
 getBank(id:string){return this.read(client=>this.bank(client,id));}
 listBanks(page:number){return this.read(async client=>{const ids=(await client.query('SELECT id FROM erp_bank_reconciliations ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $1',[(page-1)*20])).rows;return {items:await Promise.all(ids.map(row=>this.bank(client,row.id))),page,pageSize:20,total:Number((await client.query('SELECT count(*) FROM erp_bank_reconciliations')).rows[0].count)};});}
 createBank(user:User,input:BankReconciliationInput,key:string){return this.write(user,key,'bank.create',input,'books.manage',async client=>{
  await this.configured(client);const account=(await client.query("SELECT 1 FROM erp_accounts WHERE id=$1 AND control='BANK' AND active",[input.accountId])).rowCount;if(!account)throw new BadRequestException('Choose the active bank posting account.');
  if((await client.query("SELECT 1 FROM erp_bank_reconciliations WHERE account_id=$1 AND status='FINALISED' AND ends_on>=$2",[input.accountId,input.startsOn])).rowCount)throw new ConflictException('New statements must start after the last finalised statement.');
  if((await client.query('SELECT 1 FROM erp_bank_reconciliations WHERE account_id=$1 AND starts_on<=$3 AND ends_on>=$2',[input.accountId,input.startsOn,input.endsOn])).rowCount)throw new ConflictException('Bank statement periods cannot overlap.');
  const closing=input.lines.reduce((v,l)=>v+units(l.amount,2),units(input.opening,2));if(closing!==units(input.closing,2))throw new BadRequestException('Statement opening plus transactions must equal its closing balance.');
  const id=randomUUID();await client.query('INSERT INTO erp_bank_reconciliations(id,account_id,starts_on,ends_on,opening,closing,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.accountId,input.startsOn,input.endsOn,input.opening,input.closing,user.id]);
  for(const line of input.lines)await client.query('INSERT INTO erp_bank_statement_lines(id,reconciliation_id,date,reference,amount) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,line.date,line.reference,line.amount]);
  const record=await this.bank(client,id);await this.history(client,user,'bank_reconciliation',record,'created');return record;
 });}
 matchBank(user:User,id:string,input:BankMatchInput,key:string){return this.write(user,key,`bank.match:${id}`,input,'books.manage',async client=>{
  const record=await this.bank(client,id);this.checkVersion(record,input.version);if(record.status!=='DRAFT')throw new ConflictException('This bank statement is finalised.');const line=record.lines.find(l=>l.id===input.statementLineId);if(!line)throw new NotFoundException('Statement line not found.');
  if(input.journalLineId){const candidate=record.ledgerLines.find(l=>l.id===input.journalLineId);if(!candidate||units(candidate.amount,2)!==units(line.amount,2))throw new BadRequestException('Match a posted bank ledger line of the same signed amount within this statement period.');}
  await client.query('UPDATE erp_bank_statement_lines SET journal_line_id=$2 WHERE id=$1',[line.id,input.journalLineId]);await client.query('UPDATE erp_bank_reconciliations SET version=version+1 WHERE id=$1',[id]);const result=await this.bank(client,id);await this.history(client,user,'bank_reconciliation',result,'matched');return result;
 });}
 updateBank(user:User,id:string,input:BankReconciliationInput&{version:number},key:string){return this.write(user,key,`bank.update:${id}`,input,'books.manage',async client=>{
  const before=await this.bank(client,id);this.checkVersion(before,input.version);if(before.status!=='DRAFT')throw new ConflictException('Finalised statements cannot be edited.');
  if(input.accountId!==before.accountId)throw new BadRequestException('The statement bank account cannot change.');
  if((await client.query("SELECT 1 FROM erp_bank_reconciliations WHERE account_id=$1 AND status='FINALISED' AND ends_on>=$2",[input.accountId,input.startsOn])).rowCount)throw new ConflictException('Draft statement dates must follow the last finalised statement.');
  if((await client.query('SELECT 1 FROM erp_bank_reconciliations WHERE id<>$1 AND account_id=$2 AND starts_on<=$4 AND ends_on>=$3',[id,input.accountId,input.startsOn,input.endsOn])).rowCount)throw new ConflictException('Bank statement periods cannot overlap.');
  if(input.lines.reduce((v,l)=>v+units(l.amount,2),units(input.opening,2))!==units(input.closing,2))throw new BadRequestException('Statement opening plus transactions must equal its closing balance.');
  await client.query('UPDATE erp_bank_reconciliations SET starts_on=$2,ends_on=$3,opening=$4,closing=$5,version=version+1 WHERE id=$1',[id,input.startsOn,input.endsOn,input.opening,input.closing]);await client.query('DELETE FROM erp_bank_statement_lines WHERE reconciliation_id=$1',[id]);
  for(const line of input.lines)await client.query('INSERT INTO erp_bank_statement_lines(id,reconciliation_id,date,reference,amount) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,line.date,line.reference,line.amount]);const result=await this.bank(client,id);await this.history(client,user,'bank_reconciliation',result,'updated');return result;
 });}
 finaliseBank(user:User,id:string,input:{version:number},key:string){return this.write(user,key,`bank.finalise:${id}`,input,'books.manage',async client=>{
  const record=await this.bank(client,id);this.checkVersion(record,input.version);if(record.status!=='DRAFT'||!record.ready)throw new ConflictException('Match all statement lines and reconcile opening and adjusted closing balances, including outstanding items.');
  if((await client.query("SELECT 1 FROM erp_bank_reconciliations WHERE account_id=$1 AND status='DRAFT' AND starts_on<$2",[record.accountId,record.startsOn])).rowCount)throw new ConflictException('Finalise earlier draft statements first.');
  if((await client.query('SELECT $1::date>current_date AS future',[record.endsOn])).rows[0].future)throw new BadRequestException('A future statement cannot be finalised.');
  await client.query("UPDATE erp_bank_reconciliations SET status='FINALISED',version=version+1 WHERE id=$1",[id]);const result=await this.bank(client,id);await this.history(client,user,'bank_reconciliation',result,'finalised');return result;
 });}
 async historyRecords(user:User,kind:BooksHistoryKind,id:string){const permission:Permission=['warehouse','stock_movement'].includes(kind)?'inventory.read':'books.read';if(!user.permissions.includes(permission)){await this.auth.denied(user,[permission]);throw new ForbiddenException('Your account cannot view this record history.');}return this.read(async client=>(await client.query('SELECT h.id::text,h.version,h.action,h.actor_id AS "actorId",u.email AS "actorEmail",h.occurred_at AS "occurredAt",h.snapshot FROM erp_record_history h JOIN erp_users u ON u.id=h.actor_id WHERE h.entity_type=$1 AND h.entity_id=$2 ORDER BY h.version DESC LIMIT 200',[kind,id])).rows);}
}
