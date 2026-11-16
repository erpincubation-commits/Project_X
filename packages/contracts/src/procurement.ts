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
export const supplierInput = z.object({ code, name: text(160), contactEmail: optionalEmail, phone: z.string().trim().max(40).regex(/^[0-9+(). \-]*$/).default(''), paymentTermsDays: z.number().int().min(0).max(365).default(30), active: z.boolean().default(true) }).strict();
export const supplierUpdateInput = supplierInput.omit({ code: true }).extend({ version: versionInput }).strict();
export const itemInput = z.object({ code, name: text(160), description: z.string().trim().max(1000).refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)).default(''), unit: text(16).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform(value => value.toUpperCase()), active: z.boolean().default(true) }).strict();
export const itemUpdateInput = itemInput.omit({ code: true }).extend({ version: versionInput }).strict();
export const purchaseRequestInput = z.object({
  title: text(160), justification: narrative(2000).min(3), currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform(value => value.toUpperCase()),
  supplierId: z.uuid().nullable().default(null), neededBy: z.iso.date().nullable().default(null),
  lines: z.array(z.object({ itemId: z.uuid(), quantity: decimalInput(9, 6, true), estimatedUnitPrice: decimalInput(10, 4, false) }).strict()).min(1).max(100)
}).strict().refine(value => new Set(value.lines.map(line => line.itemId)).size === value.lines.length, 'Use one line per item.');
export const purchaseRequestUpdateInput = purchaseRequestInput.safeExtend({ version: versionInput });
export const submitRequestInput = z.object({ version: versionInput, approverId: z.uuid() }).strict();
export const decideRequestInput = z.object({ version: versionInput, decision: z.enum(['APPROVED', 'REJECTED']), reason: narrative(1000).default('') }).strict()
  .refine(value => value.decision !== 'REJECTED' || value.reason.length >= 3, 'Explain why the request is rejected (at least 3 characters).');
export const procurementPageInput = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().trim().max(100).default(''), activeOnly: z.enum(['true', 'false']).default('false'), status: z.enum(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).default('ALL') }).strict();
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
export interface Supplier { id: string; code: string; name: string; contactEmail?: string; phone?: string; paymentTermsDays: number; active: boolean; version: number; createdAt: string; updatedAt: string }
export interface Item extends ItemInput { id: string; version: number; createdAt: string; updatedAt: string }
export interface RecordHistory { id: string; version: number; action: string; actorId: string; actorEmail: string; occurredAt: string; snapshot: unknown }
export interface PurchaseRequestLine { id: string; itemId: string; itemCode: string; itemName: string; itemVersion: number; unit: string; quantity: string; estimatedUnitPrice: string; estimatedTotal: string }
export interface PurchaseRequest {
  id: string; number: string; title: string; justification: string; currency: string; supplierId: string | null; supplierCode: string | null; supplierName: string | null; supplierVersion: number | null;
  neededBy: string | null; status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'; requesterId: string; requesterEmail: string;
  approverId: string | null; approverEmail: string | null; submittedAt: string | null; decidedAt: string | null; decisionReason: string | null;
  version: number; createdAt: string; updatedAt: string; estimatedTotal: string; lines: PurchaseRequestLine[];
}
export interface Approver { id: string; email: string }
