import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Control characters are not allowed.');
const narrative = (max: number) => z.string().trim().max(max).refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), 'Control characters are not allowed.');
const code = text(32).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).transform(value => value.toUpperCase());
export const versionInput = z.number().int().min(1).max(2147483646);
export function decimalInput(integerDigits: number, scale: number, positive: boolean) {
  return z.string().trim().regex(new RegExp(`^(0|[1-9][0-9]{0,${integerDigits - 1}})(\\.[0-9]{1,${scale}})?$`), `Use up to ${integerDigits} whole digits and ${scale} decimal places.`)
    .refine(value => !positive || /[1-9]/.test(value), 'Quantity must be greater than zero.')
    .transform(value => value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value);
}
const optionalEmail = z.union([z.literal(''), z.email().max(254)]).default('');
export const supplierInput = z.object({ code, name: text(160), contactEmail: optionalEmail, phone: z.string().trim().max(40).regex(/^[0-9+(). \-]*$/).default(''), paymentTermsDays: z.number().int().min(0).max(365).default(30), active: z.boolean().default(true), duplicateReviewRef:z.union([z.literal(''),z.string().trim().min(3).max(100).refine(value=>!/[\x00-\x1f\x7f]/.test(value),'Control characters are not allowed.')]).default('') }).strict();
export const supplierUpdateInput = supplierInput.omit({ code: true }).extend({ version: versionInput }).strict();
const qualificationReference=z.string().trim().min(3).max(100).refine(value=>!/[^\x20-\x7e]/.test(value),'Use printable reference characters.');
export const supplierQualificationInput=z.object({registrationReference:qualificationReference,evidenceReference:qualificationReference,validUntil:z.iso.date()}).strict();
export const supplierQualificationDecision=z.object({version:versionInput,approve:z.boolean(),note:z.string().trim().min(3).max(500)}).strict();
export type SupplierQualificationInput=z.infer<typeof supplierQualificationInput>;
export type SupplierQualificationDecision=z.infer<typeof supplierQualificationDecision>;
export interface SupplierQualification {supplierId:string;registrationReference:string;evidenceReference:string;validUntil:string;status:'PENDING'|'APPROVED'|'REJECTED';expired:boolean;reviewNote:string|null;submittedByEmail:string;submittedAt:string;reviewedByEmail:string|null;reviewedAt:string|null;version:number}
export const supplierDuplicateQuery = z.object({name:text(160),excludeId:z.uuid().optional(),contactEmail:optionalEmail.optional(),phone:z.string().trim().max(40).regex(/^[0-9+(). \-]*$/).optional()}).strict();
export type SupplierDuplicateQuery = z.infer<typeof supplierDuplicateQuery>;
export interface SupplierDuplicateResult { total:number; matches:{code:string;name:string;active:boolean}[] }
const itemFields = z.object({ code, name: text(160), description: z.string().trim().max(1000).refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)).default(''), unit: text(16).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform(value => value.toUpperCase()), itemKind:z.enum(['STOCK','SERVICE']).default('STOCK'), serviceExpenseAccountId:z.uuid().nullable().default(null), active:z.boolean().default(true) }).strict();
const validItemAccount=(value:{itemKind:'STOCK'|'SERVICE';serviceExpenseAccountId:string|null})=>(value.itemKind==='STOCK')===(value.serviceExpenseAccountId===null);
export const itemInput = itemFields.refine(validItemAccount,'Select an expense account for service items only.');
export const itemUpdateInput = itemFields.omit({ code: true }).extend({ version: versionInput }).strict().refine(validItemAccount,'Select an expense account for service items only.');
export const purchaseRequestInput = z.object({
  title: text(160), justification: narrative(2000).min(3), currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform(value => value.toUpperCase()),
  supplierId: z.uuid().nullable().default(null), neededBy: z.iso.date().nullable().default(null),
  lines: z.array(z.object({ itemId: z.uuid(), quantity: decimalInput(9, 6, true), estimatedUnitPrice: decimalInput(10, 4, false) }).strict()).min(1).max(100)
}).strict().refine(value => new Set(value.lines.map(line => line.itemId)).size === value.lines.length, 'Use one line per item.');
export const purchaseRequestUpdateInput = purchaseRequestInput.safeExtend({ version: versionInput });
export const submitRequestInput = z.object({ version: versionInput, approverId: z.uuid() }).strict();
export const handoffRequestInput = z.object({version:versionInput,approverId:z.uuid(),reason:narrative(1000).min(3,'Explain the handoff in at least 3 characters.')}).strict();
export type HandoffRequestInput = z.infer<typeof handoffRequestInput>;
export const withdrawRequestInput = z.object({ version: versionInput }).strict();
export const supplierQuoteInput = z.object({ requestId: z.uuid(), requestVersion: versionInput, supplierId: z.uuid(), reference: text(100), validUntil: z.iso.date().nullable().default(null), lines: z.array(z.object({ requestLineId: z.uuid(), unitPrice: decimalInput(10,4,false) }).strict()).min(1).max(100) }).strict().refine(value=>new Set(value.lines.map(line=>line.requestLineId)).size===value.lines.length,'Use each request line once.');
export type SupplierQuoteInput = z.infer<typeof supplierQuoteInput>;
export const withdrawQuoteInput = z.object({ reason: narrative(1000).min(3, 'Explain the withdrawal in at least 3 characters.') }).strict();
export type WithdrawQuoteInput = z.infer<typeof withdrawQuoteInput>;
export const recommendQuoteInput = z.object({requestVersion:versionInput,reason:narrative(1000).min(3,'Explain the recommendation in at least 3 characters.')}).strict();
export type RecommendQuoteInput = z.infer<typeof recommendQuoteInput>;
export interface QuoteRecommendation {id:string;requestId:string;quoteId:string;supplierCode:string;supplierName:string;reference:string;reason:string;recommendedByEmail:string;recommendedAt:string;expired:boolean;withdrawnAt:string|null;supplierActive:boolean}
export interface SupplierQuote { id:string; requestId:string; requestVersion:number; supplierId:string; supplierCode:string; supplierName:string; reference:string; validUntil:string|null; expired:boolean; withdrawnAt:string|null; withdrawnByEmail:string|null; withdrawalReason:string|null; currency:string; createdAt:string; total:string; lines:{ requestLineId:string; itemCode:string; itemName:string; unit:string; quantity:string; unitPrice:string }[] }
export const decideRequestInput = z.object({ version: versionInput, decision: z.enum(['APPROVED', 'REJECTED']), reason: narrative(1000).default('') }).strict()
  .refine(value => value.decision !== 'REJECTED' || value.reason.length >= 3, 'Explain why the request is rejected (at least 3 characters).');
export const procurementPageInput = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().trim().max(100).default(''), activeOnly: z.enum(['true', 'false']).default('false'), status: z.enum(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).default('ALL'), assignedOnly: z.enum(['true','false']).default('false'), pendingHours:z.enum(['0','24','72','168']).default('0') }).strict();
export const supplierPageInput = procurementPageInput.extend({contactStatus:z.enum(['ALL','MISSING_ANY','MISSING_BOTH']).default('ALL'),qualificationStatus:z.enum(['ALL','NOT_RECORDED','PENDING','APPROVED','REJECTED','EXPIRED','EXPIRING_30_DAYS']).default('ALL')});
export type SupplierQuery = z.infer<typeof supplierPageInput>;
export type SupplierInput = z.infer<typeof supplierInput>;
export type ItemInput = z.infer<typeof itemInput>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateInput>;
export type ItemUpdateInput = z.infer<typeof itemUpdateInput>;
export type PurchaseRequestInput = z.infer<typeof purchaseRequestInput>;
export type PurchaseRequestUpdateInput = z.infer<typeof purchaseRequestUpdateInput>;
export type SubmitRequestInput = z.infer<typeof submitRequestInput>;
export type DecideRequestInput = z.infer<typeof decideRequestInput>;
export type ProcurementQuery = z.infer<typeof procurementPageInput>;
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface Supplier { id: string; code: string; name: string; contactEmail?: string; phone?: string; paymentTermsDays: number; active: boolean; version: number; createdAt: string; updatedAt: string; qualificationStatus?:'NOT_RECORDED'|'PENDING'|'APPROVED'|'REJECTED'|'EXPIRED'; qualificationValidUntil?:string|null }
export interface Item extends ItemInput { id: string; version: number; createdAt: string; updatedAt: string }
export interface RecordHistory { id: string; version: number; action: string; actorId: string; actorEmail: string; occurredAt: string; snapshot: unknown }
export interface PurchaseRequestLine { id: string; itemId: string; itemCode: string; itemName: string; itemVersion: number; unit: string; itemKind:'STOCK'|'SERVICE'; serviceExpenseAccountId:string|null; quantity: string; estimatedUnitPrice: string; estimatedTotal: string }
export interface PurchaseRequest {
  id: string; number: string; title: string; justification: string; currency: string; supplierId: string | null; supplierCode: string | null; supplierName: string | null; supplierVersion: number | null;
  neededBy: string | null; status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'; requesterId: string; requesterEmail: string;
  approverId: string | null; approverEmail: string | null; submittedAt: string | null; decidedAt: string | null; decisionReason: string | null;
  version: number; createdAt: string; updatedAt: string; estimatedTotal: string; lines: PurchaseRequestLine[];
}
export interface Approver { id: string; email: string }
export interface RequestOverview { total: number; draft: number; submitted: number; approved: number; rejected: number; assignedToMe: number }
export const approvalWorkloadQuery = z.object({ page:z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export interface ApprovalHolding {items:{historyId:string;number:string;approverEmail:string;startedAt:string;endedAt:string;endAction:string;elapsedHours:string}[];total:number;page:number;pageSize:number;from:string;to:string}
export const approvalCyclesQuery=z.object({from:z.iso.date(),to:z.iso.date(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().refine(v=>v.from<=v.to,'Invalid reporting period.');
export interface ApprovalCycles {items:{historyId:string;requestId:string;number:string;version:number;decision:string;approverEmail:string;submittedAt:string;decidedAt:string;elapsedHours:string}[];total:number;page:number;pageSize:number;from:string;to:string}
export interface ApprovalWorkloadRow { approverId:string; approverEmail:string; active:boolean; pending:number; pending24Hours:number; pending72Hours:number; oldestPendingAt:string|null; decided30Days:number; averageDecisionHours:string|null }
export interface ApprovalWorkload { items:ApprovalWorkloadRow[]; total:number; page:number; pageSize:number; asOf:string }
