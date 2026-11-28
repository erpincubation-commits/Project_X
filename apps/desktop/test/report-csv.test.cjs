const {test}=require('node:test');const assert=require('node:assert/strict');
const {csvCell,p2pReportCsv}=require('../dist/main/report-csv.js');
test('CSV quotes delimiters and neutralises spreadsheet formula prefixes, including whitespace',()=>{
 for(const value of ['=1+1','+cmd','-1+2','@SUM(A1)','  =1','\t=1','\r=1','\n=1'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('Supplier, "A"'),'"Supplier, ""A"""');assert.equal(csvCell('0012'),'"0012"');assert.equal(csvCell('10.50'),'"10.50"');
});
test('report export selects explicit columns and includes server range and export time on every data row',()=>{
 const report={from:'2026-01-01',to:'2026-11-28',currency:'INR',supplierSpend:[{supplierId:'id',supplierName:'=formula',invoiceCount:2,net:'10.50',tax:'1.05',gross:'11.55',secret:'excluded'}]};
 const csv=p2pReportCsv(report,'supplierSpend','2026-11-28T10:00:00Z');assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"2026-01-01","2026-11-28","INR","2026-11-28T10:00:00Z"'));assert.ok(csv.includes('"\'=formula"'));assert.ok(csv.endsWith('\r\n'));assert.ok(!csv.includes('excluded'));assert.equal(csv.split('\r\n').length,3);
 report.supplierSpend=[];assert.equal(p2pReportCsv(report,'supplierSpend','now').split('\r\n').length,2);
});
