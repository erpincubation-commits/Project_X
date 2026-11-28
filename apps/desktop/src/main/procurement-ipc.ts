import { z } from 'zod';
import {approvalCyclesQuery} from '@erp/contracts';
import { supplierInput, supplierUpdateInput, supplierDuplicateQuery, supplierPageInput, supplierQualificationInput, supplierQualificationDecision, itemInput, itemUpdateInput, purchaseRequestInput, purchaseRequestUpdateInput, submitRequestInput, handoffRequestInput, withdrawRequestInput, decideRequestInput, procurementPageInput, supplierQuoteInput, withdrawQuoteInput, recommendQuoteInput } from '@erp/contracts';
import type { ApiClient } from './api-client';

type Register = (channel: string, action: (...args: any[]) => unknown) => void;
const invalid = { ok: false, error: 'Check the entered fields and refresh the record if it has changed.' };
export function registerProcurementIPC(handle: Register, api: ApiClient) {
  handle('procurement:approval-holding',(input:unknown)=>{const query=approvalCyclesQuery.safeParse(input);return query.success?api.approvalHolding(query.data):invalid;});
  handle('procurement:approval-cycles',(input:unknown)=>{const query=approvalCyclesQuery.safeParse(input);return query.success?api.approvalCycles(query.data):invalid;});
  const uuid = z.uuid();
  function create<T>(channel: string,schema: z.ZodType<T>,action:(input:T,key:string)=>unknown) {
    handle(channel,(input:unknown,key:unknown)=> { const value=schema.safeParse(input),id=uuid.safeParse(key); return value.success && id.success ? action(value.data,id.data) : invalid; });
  }
  function update<T>(channel: string,schema: z.ZodType<T>,action:(id:string,input:T,key:string)=>unknown) {
    handle(channel,(id:unknown,input:unknown,key:unknown)=> { const record=uuid.safeParse(id),value=schema.safeParse(input),request=uuid.safeParse(key); return record.success && value.success && request.success ? action(record.data,value.data,request.data) : invalid; });
  }
  handle('procurement:suppliers',(input:unknown)=> { const query=supplierPageInput.safeParse(input); return query.success ? api.listSuppliers(query.data) : invalid; });
  handle('procurement:supplier-duplicates',(input:unknown)=> { const query=supplierDuplicateQuery.safeParse(input); return query.success ? api.findSupplierDuplicates(query.data) : invalid; });
  handle('procurement:supplier-qualification',(value:unknown)=>{const id=uuid.safeParse(value);return id.success?api.supplierQualification(id.data):invalid;});
  handle('procurement:items',(input:unknown)=> { const query=procurementPageInput.safeParse(input); return query.success ? api.listItems(query.data) : invalid; });
  handle('procurement:requests',(input:unknown)=> { const query=procurementPageInput.safeParse(input); return query.success ? api.listPurchaseRequests(query.data) : invalid; });
  handle('procurement:request-overview',()=>api.purchaseRequestOverview());
  handle('procurement:approval-workload',(input:unknown)=> { const query=z.number().int().min(1).max(100000).safeParse(input); return query.success ? api.approvalWorkload(query.data) : invalid; });
  handle('procurement:quote-list',(value:unknown)=> { const id=uuid.safeParse(value); return id.success ? api.listSupplierQuotes(id.data) : invalid; });
  handle('procurement:quote-recommendations',(value:unknown)=> { const id=uuid.safeParse(value); return id.success ? api.listQuoteRecommendations(id.data) : invalid; });
  handle('procurement:request',(value:unknown)=> { const id=uuid.safeParse(value); return id.success ? api.getPurchaseRequest(id.data) : invalid; });
  handle('procurement:approvers',()=>api.listApprovers());
  handle('procurement:history',(kind:unknown,value:unknown)=> { const type=z.enum(['supplier','item','purchase_request']).safeParse(kind),id=uuid.safeParse(value); return type.success && id.success ? api.recordHistory(type.data,id.data) : invalid; });
  create('procurement:supplier-create',supplierInput,(input,key)=>api.createSupplier(input,key));
  update('procurement:supplier-update',supplierUpdateInput,(id,input,key)=>api.updateSupplier(id,input,key));
  update('procurement:supplier-qualification-submit',supplierQualificationInput,(id,input,key)=>api.submitSupplierQualification(id,input,key));
  update('procurement:supplier-qualification-decide',supplierQualificationDecision,(id,input,key)=>api.decideSupplierQualification(id,input,key));
  create('procurement:item-create',itemInput,(input,key)=>api.createItem(input,key));
  update('procurement:item-update',itemUpdateInput,(id,input,key)=>api.updateItem(id,input,key));
  create('procurement:request-create',purchaseRequestInput,(input,key)=>api.createPurchaseRequest(input,key));
  create('procurement:quote-create',supplierQuoteInput,(input,key)=>api.createSupplierQuote(input,key));
  update('procurement:quote-withdraw',withdrawQuoteInput,(id,input,key)=>api.withdrawSupplierQuote(id,input,key));
  update('procurement:quote-recommend',recommendQuoteInput,(id,input,key)=>api.recommendSupplierQuote(id,input,key));
  update('procurement:request-update',purchaseRequestUpdateInput,(id,input,key)=>api.updatePurchaseRequest(id,input,key));
  update('procurement:request-submit',submitRequestInput,(id,input,key)=>api.submitPurchaseRequest(id,input,key));
  update('procurement:request-withdraw',withdrawRequestInput,(id,input,key)=>api.withdrawPurchaseRequest(id,input,key));
  update('procurement:request-reassign',submitRequestInput,(id,input,key)=>api.reassignPurchaseRequest(id,input,key));
  update('procurement:request-handoff',handoffRequestInput,(id,input,key)=>api.handoffPurchaseRequest(id,input,key));
  update('procurement:request-decide',decideRequestInput,(id,input,key)=>api.decidePurchaseRequest(id,input,key));
}
