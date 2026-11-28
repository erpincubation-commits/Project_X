import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { SupplierDuplicateResult } from '@erp/contracts';

type Candidate = { name:string; contactEmail?:string; phone?:string; duplicateReviewRef?:string };

export function supplierCandidatesOverlap(left:Candidate,right:Candidate) {
  const name=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
  const email=(value?:string)=>(value||'').trim().toLocaleLowerCase('en');
  const phone=(value?:string)=>(value||'').replace(/[^0-9]/g,'');
  return name(left.name)===name(right.name)
    || (!!email(left.contactEmail) && email(left.contactEmail)===email(right.contactEmail))
    || (phone(left.phone).length>=7 && phone(left.phone)===phone(right.phone));
}

export async function findSupplierDuplicates(client:PoolClient,candidate:Candidate,excludeId?:string):Promise<SupplierDuplicateResult> {
  const where="(lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim($1::text),'[[:space:]]+',' ','g')) OR ($3::text<>'' AND lower(btrim(contact_email))=lower(btrim($3::text))) OR (length(regexp_replace($4::text,'[^0-9]','','g'))>=7 AND regexp_replace(phone,'[^0-9]','','g')=regexp_replace($4::text,'[^0-9]','','g'))) AND ($2::uuid IS NULL OR id<>$2::uuid)";
  const values=[candidate.name,excludeId||null,candidate.contactEmail||'',candidate.phone||''];
  const rows=await client.query<{code:string;name:string;active:boolean}>(`SELECT code,name,active FROM erp_suppliers WHERE ${where} ORDER BY code LIMIT 20`,values);
  const count=await client.query<{count:string}>(`SELECT count(*) FROM erp_suppliers WHERE ${where}`,values);
  return {total:Number(count.rows[0].count),matches:rows.rows};
}

// All application supplier creates and identity edits, including imports, use this lock.
// It serializes the check with subsequent inserts/updates in the same transaction.
export async function reviewSupplierDuplicates(client:PoolClient,candidate:Candidate,excludeId?:string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('erp_supplier_duplicate_review',0))");
  const result=await findSupplierDuplicates(client,candidate,excludeId);
  if(result.total && !candidate.duplicateReviewRef) throw new ConflictException('Possible duplicate supplier. Review matches and provide a duplicate review reference before saving.');
  return result;
}
