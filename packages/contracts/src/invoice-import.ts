import {z} from 'zod';
import {supplierInvoiceInput} from './trade';
export const supplierInvoiceImportInput=z.object({formatVersion:z.literal(1),invoice:supplierInvoiceInput}).strict();
export function parseSupplierInvoiceImport(text:string){
 if(new TextEncoder().encode(text).length>65536)throw new Error('Invoice JSON must be at most 64 KiB.');
 let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Enter valid invoice JSON.');}
 const result=supplierInvoiceImportInput.safeParse(value);
 if(!result.success)throw new Error(result.error.issues.slice(0,5).map(issue=>issue.path.join('.')+': '+issue.message).join(' '));
 return result.data.invoice;
}
