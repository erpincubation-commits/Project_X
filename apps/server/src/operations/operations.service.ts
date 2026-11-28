import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { customerInput, supplierInput, itemInput, type User, type ImportPreview, type ImportResult, type PrivacyCase, type PrivacyExport, type importInput, type privacyInput, type privacyActionInput } from '@erp/contracts';
import type { z } from 'zod';
import { BooksService } from '../books/books.service';
import { AuthService, publicUser } from '../auth/auth.service';
import { findSupplierDuplicates, reviewSupplierDuplicates, supplierCandidatesOverlap } from '../procurement/supplier-duplicates';

function canonical(v:unknown):unknown {
 if(Array.isArray(v)) return v.map(canonical);
 if(v!==null&&typeof v==='object') return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,value])=>[k,canonical(value)]));
 return v;
}
const digest = (v:unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const caseColumns = `id,subject_type AS "subjectType",subject_id AS "subjectId",kind,status,legal_hold AS "legalHold",version,verification_ref AS "verificationRef",resolution_ref AS "resolutionRef",created_at AS "createdAt",received_on::text AS "receivedOn",due_at::text AS "dueAt"`;
@Injectable()
export class OperationsService {
 constructor(private readonly books:BooksService,private readonly auth:AuthService){}
 private importAccess(user:User,kind:string) {
  if(!user.permissions.includes(kind==='customer'?'customers.create':'masters.manage')) throw new ForbiddenException('You cannot import this kind of master record.');
 }
 async preview(user:User,input:z.infer<typeof importInput>,key:string):Promise<ImportPreview> {
  this.importAccess(user,input.kind);
  const normalized:Record<string,any>[]=[], errors:ImportPreview['errors']=[], seen=new Set<string>();
  const schema=input.kind==='supplier'?supplierInput:input.kind==='item'?itemInput:customerInput;
  input.rows.forEach((row,i)=>{
   const parsed=schema.safeParse(row);
   if(!parsed.success) { for(const issue of parsed.error.issues) errors.push({row:i+1,field:issue.path.join('.'),message:issue.message}); return; }
   if(input.kind==='item'&&(parsed.data as {itemKind?:string}).itemKind==='SERVICE')errors.push({row:i+1,field:'itemKind',message:'Create service items in the desktop so expense accounts are reviewed.'});
   if(seen.has(parsed.data.code)) errors.push({row:i+1,field:'code',message:'Duplicate code in this file.'});
   seen.add(parsed.data.code);normalized.push(parsed.data);
  });
  const result=await this.books.write(user,key,'import.preview',{digest:digest(input)},'imports.manage',async c=>{
   const current=publicUser((await c.query('SELECT id,email,role FROM erp_users WHERE id=$1',[user.id])).rows[0]);
   this.importAccess(current,input.kind);
   const table=input.kind==='supplier'?'erp_suppliers':input.kind==='item'?'erp_items':'erp_customers';
   const existing=new Set((await c.query(`SELECT code FROM ${table} WHERE code=ANY($1::text[])`,[[...seen]])).rows.map(r=>r.code));
   input.rows.forEach((r,i)=>{ const parsed=schema.safeParse(r);if(parsed.success&&existing.has(parsed.data.code)) errors.push({row:i+1,field:'code',message:'Code already exists. Imports only create new records.'}); });
   if(input.kind==='supplier') {
    const earlier:Array<{name:string;contactEmail:string;phone:string}>=[];
    for(let i=0;i<input.rows.length;i++) {
     const parsed=supplierInput.safeParse(input.rows[i]);if(!parsed.success)continue;
     const supplier=parsed.data;
     const inDatabase=await findSupplierDuplicates(c,supplier);
     if(!supplier.duplicateReviewRef&&(inDatabase.total||earlier.some(row=>supplierCandidatesOverlap(supplier,row))))
      errors.push({row:i+1,field:'duplicateReviewRef',message:'Possible duplicate supplier. Review matches and provide a duplicate review reference.'});
     earlier.push(supplier);
    }
   }
   let id:string|null=null, expiresAt:string|null=null, hash:string|null=null;
   if(!errors.length) {
    id=randomUUID();hash=digest({kind:input.kind,rows:normalized});
    expiresAt=(await c.query('INSERT INTO erp_import_batches(id,actor_id,kind,digest,rows) VALUES($1,$2,$3,$4,$5) RETURNING expires_at',[id,user.id,input.kind,hash,JSON.stringify(normalized)])).rows[0].expires_at;
   }
   await this.auth.audit(c,user.id,'import.preview',id||'invalid',{kind:input.kind,count:input.rows.length,errors:errors.length},'import');
   return {id,digest:hash,expiresAt,kind:input.kind,count:input.rows.length,errors,normalized:[]} as ImportPreview;
  });
  return {...result,normalized};
 }
 async commit(user:User,id:string,hash:string,key:string):Promise<ImportResult> {
  return this.books.write(user,key,`import.commit:${id}`,{digest:hash},'imports.manage',async c=>{
   const current=publicUser((await c.query('SELECT id,email,role FROM erp_users WHERE id=$1',[user.id])).rows[0]);
   const batch=(await c.query('SELECT *,expires_at>now() AS valid FROM erp_import_batches WHERE id=$1 AND actor_id=$2 FOR UPDATE',[id,user.id])).rows[0];
   if(!batch) throw new NotFoundException('Preview not found for this account.');
   this.importAccess(current,batch.kind);
   if(batch.digest!==hash) throw new ConflictException('The reviewed digest does not match this preview.');
   if(batch.committed_at) return batch.result;
   if(!batch.valid || digest({kind:batch.kind,rows:batch.rows})!==hash) throw new ConflictException('Preview expired or changed. Run a new dry run.');
   const records:string[]=[];
   for(const row of batch.rows) {
    if(batch.kind==='item'&&row.itemKind==='SERVICE')throw new ForbiddenException('Create service items in the desktop so expense accounts are reviewed.');
    const recordId=randomUUID();let record;
    if(batch.kind==='customer') {
     await c.query('INSERT INTO erp_customers(code,name) VALUES($1,$2)',[row.code,row.name]);records.push(row.code);
    } else {
     let duplicateReview: {reference:string;matchCount:number;matchedCodes:string[]}|undefined;
     if(batch.kind==='supplier') {
      const matches=await reviewSupplierDuplicates(c,row);
      if(matches.total)duplicateReview={reference:row.duplicateReviewRef,matchCount:matches.total,matchedCodes:matches.matches.map(match=>match.code)};
      record=(await c.query('INSERT INTO erp_suppliers(id,code,name,contact_email,phone,payment_terms_days,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *',[recordId,row.code,row.name,row.contactEmail,row.phone,row.paymentTermsDays,row.active,user.id])).rows[0];
     }
     else {if(row.serviceExpenseAccountId&&!(await c.query("SELECT 1 FROM erp_accounts WHERE id=$1 AND active AND type='EXPENSE' AND control IS NULL FOR SHARE",[row.serviceExpenseAccountId])).rowCount)throw new ConflictException('The service expense account is no longer available. Preview again.');record=(await c.query('INSERT INTO erp_items(id,code,name,description,unit,active,created_by,updated_by,item_kind,service_expense_account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *',[recordId,row.code,row.name,row.description,row.unit,row.active,user.id,row.itemKind,row.serviceExpenseAccountId])).rows[0];}
     await c.query('INSERT INTO erp_record_history(entity_type,entity_id,version,action,actor_id,snapshot) VALUES($1,$2,1,\'imported\',$3,$4)',[batch.kind,recordId,user.id,JSON.stringify(duplicateReview?{...record,context:{duplicateReview}}:record)]);records.push(recordId);
     if(duplicateReview)await this.auth.audit(c,user.id,'supplier.duplicate_review',recordId,duplicateReview,'supplier');
    }
    await this.auth.audit(c,user.id,`${batch.kind}.imported`,batch.kind==='customer'?row.code:recordId,{batchId:id},batch.kind);
   }
   const result={id,count:records.length,records};
   await c.query("UPDATE erp_import_batches SET committed_at=now(),rows='[]'::jsonb,result=$2 WHERE id=$1",[id,JSON.stringify(result)]);
   await this.auth.audit(c,user.id,'import.committed',id,{kind:batch.kind,count:records.length},'import');return result;
  });
 }
 private async subject(c:PoolClient,type:string,id:string,lock=false) {
  const table=type==='user'?'erp_users':type==='supplier'?'erp_suppliers':'erp_customers',pk=type==='customer'?'code':'id';
  const found=(await c.query(`SELECT ${pk} FROM ${table} WHERE ${pk}=$1${lock?' FOR UPDATE':''}`,[id])).rowCount;
  if(!found) throw new NotFoundException('Subject record not found.');
 }
 async listCases(page:number) {return this.books.read(async c=>({items:(await c.query<PrivacyCase>(`SELECT ${caseColumns} FROM erp_privacy_cases ORDER BY created_at DESC,id LIMIT 20 OFFSET $1`,[(page-1)*20])).rows,page}));}
 async createCase(user:User,input:z.infer<typeof privacyInput>,key:string) {
  return this.books.write(user,key,'privacy.create',input,'privacy.manage',async c=>{
   await this.subject(c,input.subjectType,input.subjectId);const id=randomUUID();
   if((await c.query('SELECT $1::date>current_date AS future',[input.receivedOn])).rows[0].future) throw new ConflictException('The received date cannot be in the future.');
   const record=(await c.query<PrivacyCase>(`INSERT INTO erp_privacy_cases(id,subject_type,subject_id,kind,verification_ref,created_by,received_on) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${caseColumns}`,[id,input.subjectType,input.subjectId,input.kind,input.verificationRef,user.id,input.receivedOn])).rows[0];
   await this.auth.audit(c,user.id,'privacy.opened',id,{subjectType:input.subjectType,subjectId:input.subjectId,kind:input.kind},'privacy');return record;
  });
 }
 async action(user:User,id:string,input:z.infer<typeof privacyActionInput>,key:string) {
  return this.books.write(user,key,`privacy.action:${id}`,input,'privacy.manage',async c=>{
   // The identity lock also serialises last-administrator protection with access management.
   await c.query('SELECT pg_advisory_xact_lock(83478622)');
   const record=(await c.query<PrivacyCase>(`SELECT ${caseColumns} FROM erp_privacy_cases WHERE id=$1 FOR UPDATE`,[id])).rows[0];
   if(!record) throw new NotFoundException('Privacy case not found.');
   if(record.version!==input.version) throw new ConflictException('This case changed. Refresh before deciding.');
   let status=record.status,hold=record.legalHold;
   if(input.action==='HOLD') hold=true;
   else if(input.action==='RELEASE_HOLD') hold=false;
   else {
    if(record.status!=='OPEN') throw new ConflictException('This case is already resolved. Open a new case for another action.');
    if(input.action==='RESTRICT'||input.action==='MINIMISE'||input.action==='RELEASE_RESTRICTION') {
     if(record.subjectType==='customer') throw new ConflictException('Customer restriction or erasure requires a reviewed retention plan. Record the decision without changing financial identity.');
     if(input.action==='MINIMISE' && record.kind!=='ERASURE') throw new ConflictException('Minimisation requires an erasure request.');
     if(['RESTRICT','RELEASE_RESTRICTION'].includes(input.action) && record.kind!=='RESTRICTION') throw new ConflictException('Use a restriction request for this action.');
     if((input.action==='MINIMISE'||input.action==='RELEASE_RESTRICTION') && (await c.query('SELECT 1 FROM erp_privacy_cases WHERE subject_type=$1 AND subject_id=$2 AND legal_hold',[record.subjectType,record.subjectId])).rowCount) throw new ConflictException('A legal hold blocks this action. Record an authorised release first.');
     await this.subject(c,record.subjectType,record.subjectId,true);
     if(record.subjectType==='user') {
      if(record.subjectId===user.id) throw new ForbiddenException('Another administrator must handle changes to your own account.');
      const target=(await c.query('SELECT role,active FROM erp_users WHERE id=$1',[record.subjectId])).rows[0];
      if(target.role==='admin'&&target.active&&(await c.query("SELECT count(*)::int AS count FROM erp_users WHERE role='admin' AND active")).rows[0].count<=1) throw new ConflictException('The last active administrator must be retained.');
      await c.query('UPDATE erp_users SET privacy_restricted=$2,active=false,auth_version=auth_version+1 WHERE id=$1',[record.subjectId,input.action!=='RELEASE_RESTRICTION']);
      await c.query('DELETE FROM erp_sessions WHERE user_id=$1',[record.subjectId]);await c.query('DELETE FROM erp_auth_challenges WHERE user_id=$1',[record.subjectId]);
      if(input.action==='MINIMISE') {
       await c.query("UPDATE erp_users SET email=$2,password_hash='!retired',mfa_secret=NULL,mfa_last_step=NULL WHERE id=$1",[record.subjectId,`retired-${record.subjectId}@invalid.example`]);
       await c.query('DELETE FROM erp_mfa_recovery_codes WHERE user_id=$1',[record.subjectId]);
      }
     } else {
      const row=(await c.query(`UPDATE erp_suppliers SET privacy_restricted=$2,active=false,contact_email=CASE WHEN $3 THEN '' ELSE contact_email END,phone=CASE WHEN $3 THEN '' ELSE phone END,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 RETURNING *`,[record.subjectId,input.action!=='RELEASE_RESTRICTION',input.action==='MINIMISE',user.id])).rows[0];
      await c.query("INSERT INTO erp_record_history(entity_type,entity_id,version,action,actor_id,snapshot) VALUES('supplier',$1,$2,'privacy_action',$3,$4)",[row.id,row.version,user.id,JSON.stringify(row)]);
     }
     status=input.action==='MINIMISE'?'APPLIED_WITH_RETENTION':'COMPLETED';
    } else status=input.action==='REFUSE'?'REFUSED':'COMPLETED';
   }
   const result=(await c.query<PrivacyCase>(`UPDATE erp_privacy_cases SET status=$2,legal_hold=$3,resolution_ref=$4,version=version+1 WHERE id=$1 RETURNING ${caseColumns}`,[id,status,hold,input.resolutionRef])).rows[0];
   await this.auth.audit(c,user.id,`privacy.${input.action.toLowerCase()}`,id,{subjectType:record.subjectType,subjectId:record.subjectId,status,version:result.version,resolutionRef:input.resolutionRef},'privacy');return result;
  });
 }
 async exportCase(user:User,id:string):Promise<PrivacyExport> {
  // Never persist the export body in retry responses or diagnostic logs.
  let thisExport:PrivacyExport|undefined;
  return this.books.write(user,randomUUID(),`privacy.export:${id}`,{id},'privacy.manage',async c=>{
   const record=(await c.query<PrivacyCase>(`SELECT ${caseColumns} FROM erp_privacy_cases WHERE id=$1`,[id])).rows[0];
   if(!record||record.kind!=='ACCESS') throw new NotFoundException('An identity-verified access case is required.');
   let personal;
   if(record.subjectType==='user') personal=(await c.query('SELECT id,email,role,active,privacy_restricted,created_at FROM erp_users WHERE id=$1',[record.subjectId])).rows[0];
   else if(record.subjectType==='supplier') personal=(await c.query('SELECT id,code,name,contact_email,phone,payment_terms_days,active,privacy_restricted,created_at FROM erp_suppliers WHERE id=$1',[record.subjectId])).rows[0];
   else personal=(await c.query('SELECT code,name,created_at FROM erp_customers WHERE code=$1',[record.subjectId])).rows[0];
   const history=record.subjectType==='supplier'?(await c.query("SELECT version,action,occurred_at,snapshot FROM erp_record_history WHERE entity_type='supplier' AND entity_id=$1 ORDER BY id LIMIT 10001",[record.subjectId])).rows:[];
   const supplierQuotes=record.subjectType==='supplier'?(await c.query('SELECT q.id,q.request_id,q.request_version,q.supplier_code,q.supplier_name,q.reference,q.valid_until,q.currency,q.created_by,q.created_at,w.reason AS withdrawal_reason,w.withdrawn_by,w.withdrawn_at FROM erp_supplier_quotes q LEFT JOIN erp_supplier_quote_withdrawals w ON w.quote_id=q.id WHERE q.supplier_id=$1 ORDER BY q.created_at,q.id LIMIT 10001',[record.subjectId])).rows:[];
   const supplierRecommendations=record.subjectType==='supplier'?(await c.query('SELECT r.id,r.request_id,r.quote_id,r.reason,r.recommended_by,r.recommended_at FROM erp_quote_recommendations r JOIN erp_supplier_quotes q ON q.id=r.quote_id WHERE q.supplier_id=$1 ORDER BY r.sequence LIMIT 10001',[record.subjectId])).rows:[];
   const supplierServiceAcceptances=record.subjectType==='supplier'?(await c.query('SELECT a.id,a.order_id,a.date,a.reference,a.evidence,a.accepted_by,a.created_at FROM erp_service_acceptances a JOIN erp_purchase_orders o ON o.id=a.order_id WHERE o.supplier_id=$1 ORDER BY a.created_at,a.id LIMIT 10001',[record.subjectId])).rows:[];
   const activity=(await c.query(`SELECT id::text,action,entity_type,entity_id,occurred_at FROM erp_audit_events WHERE (entity_type=$1 AND entity_id=$2) OR ($1='user' AND actor_id::text=$2) ORDER BY id LIMIT 10001`,[record.subjectType,record.subjectId])).rows;
   if(history.length>10000||activity.length>10000||supplierQuotes.length>10000||supplierRecommendations.length>10000||supplierServiceAcceptances.length>10000) throw new ConflictException('Export exceeds the interactive limit. Arrange a reviewed offline export; no partial file was returned.');
   await this.auth.audit(c,user.id,'privacy.exported',id,{subjectType:record.subjectType,subjectId:record.subjectId},'privacy');
   // Return through a closure below to keep the personal data out of erp_operations.
   thisExport={caseId:id,generatedAt:new Date().toISOString(),record:personal,history,activity,supplierQuotes,supplierRecommendations,supplierServiceAcceptances,reviewRequired:['Review quotation and service line details, free-text business records, historical snapshots, imports, logs, backups and third-party information before disclosure.','Supply processing purposes, recipients, retention and rights information separately. This is an operational extract, not an automatic complete rights response.']};
   return {exported:true};
  }).then(()=>thisExport!);
 }
}
