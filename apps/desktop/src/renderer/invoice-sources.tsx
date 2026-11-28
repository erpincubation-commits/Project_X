import React,{useState} from 'react';
import type {GoodsReceipt,PurchaseOrder,ServiceAcceptance,TradeInvoice} from '@erp/contracts';
import type {TradeContext} from './trade-workspace';
import {clean} from './books-workspace';

export function InvoiceSources({ctx,invoice}:{ctx:TradeContext;invoice:TradeInvoice}){
 const [sources,setSources]=useState<{order:PurchaseOrder;receipts:GoodsReceipt[];services:ServiceAcceptance[]}|null>(null);
 if(invoice.kind!=='AP'||!invoice.orderId||!ctx.user.permissions.includes('orders.read'))return null;
 async function load(){
  setSources(null);
  const [o,r,s]=await Promise.all([window.erp.getOrder(invoice.orderId!),window.erp.listOrderReceipts(invoice.orderId!),window.erp.listServiceAcceptances(invoice.orderId!)]);
  const order=ctx.read(o),receipts=ctx.read(r),services=ctx.read(s);
  if(order&&receipts&&services)setSources({order,receipts,services});
 }
 return <section aria-label="Supplier invoice sources"><h3>Invoice source documents</h3><button type="button" className="secondary" disabled={ctx.busy} onClick={()=>void ctx.run(load)}>Review invoice source documents</button><p>Loads current saved order and allocated acceptance records. Refresh after other users act; these quantities do not replace three-way matching.</p>{sources&&<>
  <h4>Source order {sources.order.number}</h4><p>{sources.order.supplierCode} · {sources.order.supplierName} · {sources.order.date} · {sources.order.status} · version {sources.order.version}</p><p>{sources.order.description}</p>
  {invoice.lines.map((line,index)=>{
   const orderLine=sources.order.lines.find(row=>row.id===line.orderLineId);
   const receipt=sources.receipts.find(row=>row.lines.some(l=>l.id===line.receiptLineId));
   const goods=receipt?.lines.find(row=>row.id===line.receiptLineId);
   const acceptance=sources.services.find(row=>row.lines.some(l=>l.id===line.serviceAcceptanceLineId));
   const service=acceptance?.lines.find(row=>row.id===line.serviceAcceptanceLineId);
   return <section key={line.id} aria-label={`Invoice source line ${index+1}`}><h4>Line {index+1}: {orderLine?.itemCode||line.description}</h4>
    {orderLine?<p>Ordered {clean(orderLine.quantity)} {orderLine.unit} at INR {clean(orderLine.unitPrice)} · Invoiced {clean(line.quantity)} at INR {clean(line.unitPrice)}</p>:<p>Order line unavailable. Refresh and ask Finance to review the source link.</p>}
    {receipt&&goods&&<><p>Goods receipt {receipt.number} · {receipt.date} · Reference: {receipt.reference} · Warehouse: {receipt.warehouseCode}</p><p>Accepted {clean(goods.accepted)} · Damaged {clean(goods.damaged)} · Current uninvoiced quantity {clean(goods.available)}</p>{goods.damageReason&&<p>Damage evidence: {goods.damageReason}</p>}</>}
    {acceptance&&service&&<><p>Service acceptance {acceptance.number} · {acceptance.date} · Reference: {acceptance.reference}</p><p>Evidence: {acceptance.evidence}</p><p>Accepted {clean(service.quantity)} · Value INR {service.value} · Current uninvoiced quantity {clean(service.available)}</p></>}
    {!goods&&!service&&<p>No allocated acceptance record available for this invoice line. Missing acceptance must be resolved through the invoice workflow.</p>}
   </section>;
  })}
 </>}</section>;
}
