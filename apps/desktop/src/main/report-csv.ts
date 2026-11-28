import type {FinancialStatements} from '@erp/contracts';
export const p2pReportKinds=['supplierSpend','itemSpend','orderedValue','supplierDelivery','supplierExceptions'] as const;
export type P2PReportKind=typeof p2pReportKinds[number];
const columns:Record<P2PReportKind,string[]>={
 supplierSpend:['supplierId','supplierName','invoiceCount','net','tax','gross'],
 itemSpend:['itemId','itemCode','itemName','itemKind','unit','invoiceCount','quantity','net','tax','gross'],
 orderedValue:['supplierId','supplierName','orderCount','lineCount','net','openOrderCount','unacceptedNet'],
 supplierDelivery:['supplierId','supplierName','promisedOrders','completedOnTime','completedLate','openOverdue','openNotDue'],
 supplierExceptions:['supplierId','supplierName','damagedReceiptCount','damagedQuantity','invoiceExceptionEvents','affectedInvoiceCount']
};
export function csvCell(value:unknown){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function p2pReportCsv(report:FinancialStatements,kind:P2PReportKind,exportedAt:string){
 const fields=columns[kind];const headers=['report','from','to','currency','exportedAt',...fields];
 const rows=(report[kind] as unknown as Record<string,unknown>[]).map(row=>[kind,report.from,report.to,report.currency,exportedAt,...fields.map(field=>row[field])]);
 return '\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
