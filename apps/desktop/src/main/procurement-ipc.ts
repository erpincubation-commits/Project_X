import { z } from 'zod';
import { supplierInput, supplierUpdateInput, itemInput, itemUpdateInput, purchaseRequestInput, purchaseRequestUpdateInput, submitRequestInput, decideRequestInput, procurementPageInput } from '@erp/contracts';
import type { ApiClient } from './api-client';

type Register = (channel: string, action: (...args: any[]) => unknown) => void;
const invalid = { ok: false, error: 'Check the entered fields and refresh the record if it has changed.' };
export function registerProcurementIPC(handle: Register, api: ApiClient) {
  const uuid = z.uuid();
  function create<T>(channel: string,schema: z.ZodType<T>,action:(input:T,key:string)=>unknown) {
    handle(channel,(input:unknown,key:unknown)=> { const value=schema.safeParse(input),id=uuid.safeParse(key); return value.success && id.success ? action(value.data,id.data) : invalid; });
  }
  function update<T>(channel: string,schema: z.ZodType<T>,action:(id:string,input:T,key:string)=>unknown) {
    handle(channel,(id:unknown,input:unknown,key:unknown)=> { const record=uuid.safeParse(id),value=schema.safeParse(input),request=uuid.safeParse(key); return record.success && value.success && request.success ? action(record.data,value.data,request.data) : invalid; });
  }
  handle('procurement:suppliers',(input:unknown)=> { const query=procurementPageInput.safeParse(input); return query.success ? api.listSuppliers(query.data) : invalid; });
  handle('procurement:items',(input:unknown)=> { const query=procurementPageInput.safeParse(input); return query.success ? api.listItems(query.data) : invalid; });
  handle('procurement:requests',(input:unknown)=> { const query=procurementPageInput.safeParse(input); return query.success ? api.listPurchaseRequests(query.data) : invalid; });
  handle('procurement:request',(value:unknown)=> { const id=uuid.safeParse(value); return id.success ? api.getPurchaseRequest(id.data) : invalid; });
  handle('procurement:approvers',()=>api.listApprovers());
  handle('procurement:history',(kind:unknown,value:unknown)=> { const type=z.enum(['supplier','item','purchase_request']).safeParse(kind),id=uuid.safeParse(value); return type.success && id.success ? api.recordHistory(type.data,id.data) : invalid; });
  create('procurement:supplier-create',supplierInput,(input,key)=>api.createSupplier(input,key));
  update('procurement:supplier-update',supplierUpdateInput,(id,input,key)=>api.updateSupplier(id,input,key));
  create('procurement:item-create',itemInput,(input,key)=>api.createItem(input,key));
  update('procurement:item-update',itemUpdateInput,(id,input,key)=>api.updateItem(id,input,key));
  create('procurement:request-create',purchaseRequestInput,(input,key)=>api.createPurchaseRequest(input,key));
  update('procurement:request-update',purchaseRequestUpdateInput,(id,input,key)=>api.updatePurchaseRequest(id,input,key));
  update('procurement:request-submit',submitRequestInput,(id,input,key)=>api.submitPurchaseRequest(id,input,key));
  update('procurement:request-decide',decideRequestInput,(id,input,key)=>api.decidePurchaseRequest(id,input,key));
}
