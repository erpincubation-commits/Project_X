import {Injectable} from '@nestjs/common';
import type {AgeingRow,FinancialStatements,SubledgerReport} from '@erp/contracts';
import {BooksService,units,decimal} from '../books/books.service';
@Injectable()
export class ReportsService{
 constructor(private readonly books:BooksService){}
 subledgers(date:string):Promise<SubledgerReport>{return this.books.read(async c=>{await this.books.configured(c);const controls=(await c.query('SELECT control,subledger::text,ledger::text,difference::text FROM erp_trade_reconciliation($1) ORDER BY control',[date])).rows;
  const invoices=(await c.query(`SELECT i.id AS "invoiceId",i.kind,i.number,i.party_name AS "partyName",i.date::text,i.due_date::text AS "dueDate",(i.gross-CASE WHEN i.kind='AP' THEN coalesce((SELECT sum(a.amount) FROM erp_payment_allocations a JOIN erp_payments p ON p.id=a.payment_id WHERE a.invoice_id=i.id AND p.status='EXECUTED' AND p.execution_date<=$1),0) ELSE coalesce((SELECT sum(a.amount) FROM erp_collection_allocations a JOIN erp_collections r ON r.id=a.collection_id WHERE a.invoice_id=i.id AND r.date<=$1),0) END)::text AS outstanding,greatest($1::date-i.due_date,0) AS "daysOverdue" FROM erp_trade_invoices i WHERE i.status='POSTED' AND i.date<=$1 ORDER BY i.due_date,i.number`,[date])).rows.filter(r=>units(r.outstanding,2)>0n).map(r=>({...r,bucket:r.daysOverdue===0?'Not overdue':r.daysOverdue<=30?'1–30 days':r.daysOverdue<=60?'31–60 days':r.daysOverdue<=90?'61–90 days':'Over 90 days'}));
  return {date,controls,balanced:controls.every(r=>units(r.difference,2)===0n),payables:invoices.filter(r=>r.kind==='AP') as AgeingRow[],receivables:invoices.filter(r=>r.kind==='AR') as AgeingRow[]};
 });}
 statements(from:string,to:string):Promise<FinancialStatements>{return this.books.read(async c=>{await this.books.configured(c);
  const balances=(await c.query(`SELECT a.code,a.name,a.type,coalesce(sum(l.debit-l.credit) FILTER(WHERE j.status='POSTED' AND j.date<=$2),0)::text AS cumulative,coalesce(sum(l.debit-l.credit) FILTER(WHERE j.status='POSTED' AND j.date BETWEEN $1 AND $2),0)::text AS period FROM erp_accounts a LEFT JOIN erp_journal_lines l ON l.account_id=a.id LEFT JOIN erp_journals j ON j.id=l.journal_id GROUP BY a.id ORDER BY a.code`,[from,to])).rows;
  const lines=(type:string,period:boolean,credit:boolean)=>balances.filter(r=>r.type===type).map(r=>({code:r.code,name:r.name,amount:decimal(units(period?r.period:r.cumulative,2)*(credit?-1n:1n))}));const sum=(rows:{amount:string}[])=>rows.reduce((n,r)=>n+units(r.amount,2),0n);
  const income=lines('INCOME',true,true),expenses=lines('EXPENSE',true,false),assets=lines('ASSET',false,false),liabilities=lines('LIABILITY',false,true),equity=lines('EQUITY',false,true),retained=sum(lines('INCOME',false,true))-sum(lines('EXPENSE',false,false));
  const cash=(await c.query(`SELECT coalesce(sum(l.debit-l.credit) FILTER(WHERE j.date<$1),0)::text AS opening,coalesce(sum(l.debit-l.credit),0)::text AS closing FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id JOIN erp_accounts a ON a.id=l.account_id WHERE a.control='BANK' AND j.status='POSTED' AND j.date<=$2`,[from,to])).rows[0];
  const cashMovements=(await c.query(`SELECT j.cash_flow_category AS category,sum(l.debit-l.credit)::text AS amount,count(*)::int AS count FROM erp_journal_lines l JOIN erp_journals j ON j.id=l.journal_id JOIN erp_accounts a ON a.id=l.account_id WHERE a.control='BANK' AND j.status='POSTED' AND j.date BETWEEN $1 AND $2 GROUP BY j.cash_flow_category ORDER BY j.cash_flow_category`,[from,to])).rows;
  const taxes=(await c.query(`SELECT l.tax_code AS code,l.tax_rate::text AS rate,coalesce(sum(l.tax) FILTER(WHERE i.kind='AP' AND l.recoverable),0)::text AS "inputRecoverable",coalesce(sum(l.tax) FILTER(WHERE i.kind='AP' AND NOT l.recoverable),0)::text AS "inputNonrecoverable",coalesce(sum(l.tax) FILTER(WHERE i.kind='AR'),0)::text AS output FROM erp_trade_invoice_lines l JOIN erp_trade_invoices i ON i.id=l.invoice_id WHERE i.status='POSTED' AND i.date BETWEEN $1 AND $2 GROUP BY l.tax_code,l.tax_rate ORDER BY l.tax_code,l.tax_rate`,[from,to])).rows;
  const orderedValue=(await c.query(`WITH accepted AS (
    SELECT order_line_id,sum(quantity) AS quantity FROM (
      SELECT order_line_id,accepted AS quantity FROM erp_receipt_lines WHERE accepted>0
      UNION ALL
      SELECT order_line_id,quantity FROM erp_service_acceptance_lines
    ) a GROUP BY order_line_id
  ), line_values AS (
    SELECT o.id AS order_id,o.supplier_id,o.supplier_name,l.id AS line_id,l.quantity*l.unit_price AS net,greatest(l.quantity-coalesce(a.quantity,0),0)*l.unit_price AS unaccepted_net,greatest(l.quantity-coalesce(a.quantity,0),0)>0 AS open
    FROM erp_purchase_orders o JOIN erp_order_lines l ON l.order_id=o.id LEFT JOIN accepted a ON a.order_line_id=l.id
    WHERE o.status='ISSUED' AND o.date BETWEEN $1 AND $2
  )
  SELECT supplier_id AS "supplierId",supplier_name AS "supplierName",count(DISTINCT order_id)::int AS "orderCount",count(line_id)::int AS "lineCount",sum(net)::text AS net,count(DISTINCT order_id) FILTER(WHERE open)::int AS "openOrderCount",sum(unaccepted_net)::text AS "unacceptedNet" FROM line_values GROUP BY supplier_id,supplier_name ORDER BY sum(unaccepted_net) DESC,supplier_name,supplier_id`,[from,to])).rows;
  const supplierSpend=(await c.query(`SELECT i.supplier_id AS "supplierId",i.party_name AS "supplierName",count(*)::int AS "invoiceCount",sum(i.net)::text AS net,sum(i.tax)::text AS tax,sum(i.gross)::text AS gross FROM erp_trade_invoices i WHERE i.kind='AP' AND i.status='POSTED' AND i.date BETWEEN $1 AND $2 GROUP BY i.supplier_id,i.party_name ORDER BY sum(i.net) DESC,i.party_name,i.supplier_id`,[from,to])).rows;
  const itemSpend=(await c.query(`SELECT o.item_id AS "itemId",o.item_code AS "itemCode",o.item_name AS "itemName",o.item_kind AS "itemKind",o.unit,count(DISTINCT i.id)::int AS "invoiceCount",sum(l.quantity)::text AS quantity,sum(l.net)::text AS net,sum(l.tax)::text AS tax,sum(l.net+l.tax)::text AS gross FROM erp_trade_invoices i JOIN erp_trade_invoice_lines l ON l.invoice_id=i.id JOIN erp_order_lines o ON o.id=l.order_line_id WHERE i.kind='AP' AND i.status='POSTED' AND i.date BETWEEN $1 AND $2 GROUP BY o.item_id,o.item_code,o.item_name,o.item_kind,o.unit ORDER BY sum(l.net) DESC,o.item_code,o.item_name`,[from,to])).rows;
  const spendSum=(rows:{net:string;tax:string;gross:string}[],field:'net'|'tax'|'gross')=>rows.reduce((total,row)=>total+units(row[field],2),0n);
  const itemSpendReconciled=(['net','tax','gross'] as const).every(field=>spendSum(itemSpend,field)===spendSum(supplierSpend,field));
  const supplierDelivery=(await c.query(`WITH selected_orders AS (
    SELECT o.id,o.supplier_id,o.supplier_name,p.expected_on FROM erp_purchase_orders o
    JOIN LATERAL (SELECT nullif(h.snapshot->'acknowledgement'->>'expectedOn','')::date AS expected_on FROM erp_record_history h WHERE h.entity_type='purchase_order' AND h.entity_id=o.id AND h.action='supplier_acknowledged' ORDER BY h.version DESC LIMIT 1) p ON p.expected_on IS NOT NULL
    WHERE o.status='ISSUED' AND o.date BETWEEN $1 AND $2
  ), deliveries AS (
    SELECT r.order_line_id,r.accepted AS quantity,g.date FROM erp_receipt_lines r JOIN erp_goods_receipts g ON g.id=r.receipt_id JOIN erp_order_lines l ON l.id=r.order_line_id JOIN selected_orders o ON o.id=l.order_id WHERE r.accepted>0
    UNION ALL
    SELECT a.order_line_id,a.quantity,s.date FROM erp_service_acceptance_lines a JOIN erp_service_acceptances s ON s.id=a.acceptance_id JOIN erp_order_lines l ON l.id=a.order_line_id JOIN selected_orders o ON o.id=l.order_id
  ), line_delivery AS (
    SELECT order_line_id,sum(quantity) AS quantity,max(date) AS last_date FROM deliveries GROUP BY order_line_id
  ), order_delivery AS (
    SELECT l.order_id,bool_and(coalesce(d.quantity,0)>=l.quantity) AS complete,max(d.last_date) AS completed_on FROM erp_order_lines l JOIN selected_orders o ON o.id=l.order_id LEFT JOIN line_delivery d ON d.order_line_id=l.id GROUP BY l.order_id
  )
  SELECT o.supplier_id AS "supplierId",o.supplier_name AS "supplierName",count(*)::int AS "promisedOrders",
    count(*) FILTER(WHERE d.complete AND d.completed_on<=o.expected_on)::int AS "completedOnTime",
    count(*) FILTER(WHERE d.complete AND d.completed_on>o.expected_on)::int AS "completedLate",
    count(*) FILTER(WHERE NOT d.complete AND o.expected_on<current_date)::int AS "openOverdue",
    count(*) FILTER(WHERE NOT d.complete AND o.expected_on>=current_date)::int AS "openNotDue"
  FROM selected_orders o JOIN order_delivery d ON d.order_id=o.id GROUP BY o.supplier_id,o.supplier_name ORDER BY count(*) FILTER(WHERE NOT d.complete AND o.expected_on<current_date) DESC,o.supplier_name,o.supplier_id`,[from,to])).rows;
  const supplierExceptions=(await c.query(`WITH events AS (
    SELECT o.supplier_id,o.supplier_name,g.id AS receipt_id,sum(r.damaged) AS damaged_quantity,0::int AS invoice_exception_events,NULL::uuid AS invoice_id
    FROM erp_goods_receipts g JOIN erp_receipt_lines r ON r.receipt_id=g.id JOIN erp_order_lines l ON l.id=r.order_line_id JOIN erp_purchase_orders o ON o.id=l.order_id
    WHERE g.date BETWEEN $1 AND $2 AND r.damaged>0 GROUP BY o.supplier_id,o.supplier_name,g.id
    UNION ALL
    SELECT (h.snapshot->>'partyId')::uuid,h.snapshot->>'partyName',NULL::uuid,0::numeric,1,h.entity_id
    FROM erp_record_history h WHERE h.entity_type='supplier_invoice' AND h.action='matched' AND h.snapshot->>'matchStatus'='EXCEPTION' AND h.occurred_at::date BETWEEN $1 AND $2 AND h.snapshot->>'partyId' IS NOT NULL
  )
  SELECT supplier_id AS "supplierId",supplier_name AS "supplierName",count(DISTINCT receipt_id)::int AS "damagedReceiptCount",sum(damaged_quantity)::text AS "damagedQuantity",sum(invoice_exception_events)::int AS "invoiceExceptionEvents",count(DISTINCT invoice_id)::int AS "affectedInvoiceCount"
  FROM events GROUP BY supplier_id,supplier_name ORDER BY sum(invoice_exception_events) DESC,count(DISTINCT receipt_id) DESC,supplier_name,supplier_id`,[from,to])).rows;
  return {orderedValue,supplierSpend,itemSpend,itemSpendReconciled,supplierDelivery,supplierExceptions,from,to,currency:'INR',income,expenses,revenue:decimal(sum(income)),expense:decimal(sum(expenses)),profit:decimal(sum(income)-sum(expenses)),assets,liabilities,equity,assetTotal:decimal(sum(assets)),liabilityTotal:decimal(sum(liabilities)),equityTotal:decimal(sum(equity)+retained),retainedEarnings:decimal(retained),balanceDifference:decimal(sum(assets)-sum(liabilities)-sum(equity)-retained),cashOpening:cash.opening,cashClosing:cash.closing,cashMovements,unclassifiedCashCount:cashMovements.filter(r=>r.category==='UNCLASSIFIED').reduce((n,r)=>n+r.count,0),taxes};
 });}
}
