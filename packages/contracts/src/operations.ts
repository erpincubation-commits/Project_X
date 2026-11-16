import { z } from 'zod';
import type { Result } from './index';

export const importInput = z.object({ kind: z.enum(['supplier','item','customer']), rows: z.array(z.unknown()).min(1).max(100) }).strict();
export const importCommitInput = z.object({ digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const reference = z.string().trim().min(3).max(300).refine(v => !/[\x00-\x1f\x7f]/.test(v));
export const privacyInput = z.object({ subjectType: z.enum(['user','supplier','customer']), subjectId: z.string().min(1).max(36), kind: z.enum(['ACCESS','RECTIFICATION','ERASURE','RESTRICTION']), receivedOn:z.iso.date(), verificationRef: reference }).strict().superRefine((v,c) => {
  if (!(v.subjectType==='customer' ? /^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(v.subjectId) : z.uuid().safeParse(v.subjectId).success)) c.addIssue({ code:'custom',path:['subjectId'],message:'Enter a valid subject ID or customer code.' });
});
export const privacyActionInput = z.object({ version:z.number().int().min(1), action:z.enum(['HOLD','RELEASE_HOLD','RESTRICT','RELEASE_RESTRICTION','MINIMISE','COMPLETE','REFUSE']), resolutionRef:reference }).strict();
export interface ImportPreview { id:string|null; digest:string|null; expiresAt:string|null; kind:string; count:number; errors:{row:number;field:string;message:string}[]; normalized:unknown[] }
export interface ImportResult { id:string; count:number; records:string[] }
export interface PrivacyCase { id:string; subjectType:'user'|'supplier'|'customer'; subjectId:string; kind:string; status:string; legalHold:boolean; version:number; verificationRef:string; resolutionRef:string|null; createdAt:string; receivedOn:string; dueAt:string }
export interface PrivacyExport { caseId:string; generatedAt:string; record:unknown; history:unknown[]; activity:unknown[]; reviewRequired:string[] }
export interface OperationsAPI {
 previewImport(input:z.infer<typeof importInput>,key:string):Promise<Result<ImportPreview>>;
 commitImport(id:string,input:z.infer<typeof importCommitInput>,key:string):Promise<Result<ImportResult>>;
 listPrivacyCases(page:number):Promise<Result<{items:PrivacyCase[];page:number}>>;
 createPrivacyCase(input:z.infer<typeof privacyInput>,key:string):Promise<Result<PrivacyCase>>;
 privacyAction(id:string,input:z.infer<typeof privacyActionInput>,key:string):Promise<Result<PrivacyCase>>;
 exportPrivacyCase(id:string):Promise<Result<PrivacyExport>>;
}
