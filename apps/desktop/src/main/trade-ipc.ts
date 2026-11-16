import {z} from 'zod';
import * as C from '@erp/contracts';
import type {ApiClient} from './api-client';
type Register=(channel:string,action:(...args:any[])=>unknown)=>void;
export function registerTradeIPC(handle:Register,api:ApiClient){
 const uuid=z.uuid(),pageSchema=z.number().int().min(1).max(100000);
 handle('trade:listOrderReceipts',(value:unknown)=>{const id=uuid.safeParse(value);return id.success?api.listOrderReceipts(id.data):{ok:false,error:'Select a valid order.'};});
 function register<T extends unknown[]>(name:string,schema:z.ZodType<T>,action:(...args:T)=>unknown){handle(`trade:${name}`,(...args:unknown[])=>{const result=schema.safeParse(args);return result.success?action(...result.data):{ok:false,error:result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' ')};});}
 register('listTaxCodes',z.tuple([]),()=>api.listTaxCodes());
 register('createTaxCode',z.tuple([C.taxInput,uuid]),(input,key)=>api.createTaxCode(input,key));
 register('updateTaxCode',z.tuple([uuid,C.taxUpdateInput,uuid]),(id,input,key)=>api.updateTaxCode(id,input,key));
 register('listOrders',z.tuple([pageSchema]),(page)=>api.listOrders(page));
 register('getOrder',z.tuple([uuid]),(id)=>api.getOrder(id));
 register('createOrder',z.tuple([C.orderInput,uuid]),(input,key)=>api.createOrder(input,key));
 register('cancelOrder',z.tuple([uuid,C.orderCancelInput,uuid]),(id,input,key)=>api.cancelOrder(id,input,key));
 register('listReceipts',z.tuple([pageSchema]),(page)=>api.listReceipts(page));
 register('getReceipt',z.tuple([uuid]),(id)=>api.getReceipt(id));
 register('createReceipt',z.tuple([C.receiptInput,uuid]),(input,key)=>api.createReceipt(input,key));
 register('listSupplierInvoices',z.tuple([pageSchema]),(page)=>api.listSupplierInvoices(page));
 register('getSupplierInvoice',z.tuple([uuid]),(id)=>api.getSupplierInvoice(id));
 register('createSupplierInvoice',z.tuple([C.supplierInvoiceInput,uuid]),(input,key)=>api.createSupplierInvoice(input,key));
 register('updateSupplierInvoice',z.tuple([uuid,C.supplierInvoiceUpdateInput,uuid]),(id,input,key)=>api.updateSupplierInvoice(id,input,key));
 register('matchSupplierInvoice',z.tuple([uuid,C.postJournalInput,uuid]),(id,input,key)=>api.matchSupplierInvoice(id,input,key));
 register('resolveSupplierInvoice',z.tuple([uuid,C.resolveInvoiceInput,uuid]),(id,input,key)=>api.resolveSupplierInvoice(id,input,key));
 register('postSupplierInvoice',z.tuple([uuid,C.postJournalInput,uuid]),(id,input,key)=>api.postSupplierInvoice(id,input,key));
 register('listCustomerInvoices',z.tuple([pageSchema]),(page)=>api.listCustomerInvoices(page));
 register('getCustomerInvoice',z.tuple([uuid]),(id)=>api.getCustomerInvoice(id));
 register('createCustomerInvoice',z.tuple([C.customerInvoiceInput,uuid]),(input,key)=>api.createCustomerInvoice(input,key));
 register('updateCustomerInvoice',z.tuple([uuid,C.customerInvoiceUpdateInput,uuid]),(id,input,key)=>api.updateCustomerInvoice(id,input,key));
 register('postCustomerInvoice',z.tuple([uuid,C.postJournalInput,uuid]),(id,input,key)=>api.postCustomerInvoice(id,input,key));
 register('voidInvoice',z.tuple([uuid,C.orderCancelInput,uuid]),(id,input,key)=>api.voidInvoice(id,input,key));
 register('listPayments',z.tuple([pageSchema]),(page)=>api.listPayments(page));
 register('getPayment',z.tuple([uuid]),(id)=>api.getPayment(id));
 register('createPayment',z.tuple([C.paymentInput,uuid]),(input,key)=>api.createPayment(input,key));
 register('updatePayment',z.tuple([uuid,C.paymentUpdateInput,uuid]),(id,input,key)=>api.updatePayment(id,input,key));
 register('submitPayment',z.tuple([uuid,C.postJournalInput,uuid]),(id,input,key)=>api.submitPayment(id,input,key));
 register('decidePayment',z.tuple([uuid,C.paymentDecisionInput,uuid]),(id,input,key)=>api.decidePayment(id,input,key));
 register('executePayment',z.tuple([uuid,C.paymentExecutionInput,uuid]),(id,input,key)=>api.executePayment(id,input,key));
 register('cancelPayment',z.tuple([uuid,C.orderCancelInput,uuid]),(id,input,key)=>api.cancelPayment(id,input,key));
 register('paymentApprovers',z.tuple([]),()=>api.paymentApprovers());
 register('listCollections',z.tuple([pageSchema]),(page)=>api.listCollections(page));
 register('createCollection',z.tuple([C.collectionInput,uuid]),(input,key)=>api.createCollection(input,key));
 register('subledgerReport',z.tuple([z.iso.date()]),(date)=>api.subledgerReport(date));
 register('financialStatements',z.tuple([z.iso.date(),z.iso.date()]),(from,to)=>api.financialStatements(from,to));
 register('tradeHistory',z.tuple([z.enum(['tax','purchase_order','goods_receipt','supplier_invoice','customer_invoice','payment','collection']),uuid]),(kind,id)=>api.tradeHistory(kind,id));
}

