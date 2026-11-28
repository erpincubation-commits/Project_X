const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {parseSupplierInvoiceImport}=require('@erp/contracts');
const sample=()=>({formatVersion:1,invoice:{orderId:randomUUID(),reference:' SYNTHETIC-01 ',date:'2026-11-01',dueDate:'2026-11-30',description:'Synthetic supplier invoice',lines:[{orderLineId:randomUUID(),receiptLineId:randomUUID(),quantity:'2',unitPrice:'10.5',taxId:randomUUID()}]}});
test('invoice JSON import accepts the versioned single-invoice format and normalises through the shared contract',()=>{
 const data=sample(),invoice=parseSupplierInvoiceImport(JSON.stringify(data));assert.equal(invoice.reference,'SYNTHETIC-01');assert.equal(invoice.lines[0].serviceAcceptanceLineId,null);assert.equal(invoice.orderId,data.invoice.orderId);
});
test('invoice JSON rejects malformed, oversized, unsupported and privileged data',()=>{
 assert.throws(()=>parseSupplierInvoiceImport('{'),/valid invoice JSON/);assert.throws(()=>parseSupplierInvoiceImport(' '.repeat(65537)),/64 KiB/);assert.throws(()=>parseSupplierInvoiceImport('é'.repeat(32769)),/64 KiB/);
 for(const mutate of [d=>{d.formatVersion=2;},d=>{d.invoice.status='POSTED';},d=>{d.invoice.lines[0].quantity='-1';},d=>{d.invoice.dueDate='2026-10-01';},d=>{d.invoice.lines[0].serviceAcceptanceLineId=randomUUID();},d=>{d.invoice.lines.push({...d.invoice.lines[0]});},d=>{d.invoice.lines=Array.from({length:101},()=>({...d.invoice.lines[0],receiptLineId:randomUUID()}));}]){
  const data=sample();mutate(data);assert.throws(()=>parseSupplierInvoiceImport(JSON.stringify(data)));
 }
 assert.throws(()=>parseSupplierInvoiceImport(JSON.stringify([sample()])));
});
