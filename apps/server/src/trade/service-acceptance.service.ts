import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {User,TradeHistoryKind} from '@erp/contracts';
import {BooksService,decimal,units} from '../books/books.service';
import {controls,lineValue,postingLines} from './trade-common';

export interface ServiceAcceptanceInput {orderId:string;version:number;date:string;reference:string;evidence:string;lines:{orderLineId:string;quantity:string}[]}
@Injectable()
export class ServiceAcceptanceService {
 constructor(private readonly books:BooksService){}
 async acceptance(c:PoolClient,id:string){
  const row=(await c.query(`SELECT a.id,a.number,a.order_id AS "orderId",o.number AS "orderNumber",a.date::text,a.created_at AS "recordedAt",greatest(0,(a.created_at AT TIME ZONE 'UTC')::date-a.date) AS "entryLagDays",a.reference,a.evidence,a.accepted_by AS "acceptedBy",a.journal_id AS "journalId",1 AS version FROM erp_service_acceptances a JOIN erp_purchase_orders o ON o.id=a.order_id WHERE a.id=$1`,[id])).rows[0];
  if(!row)throw new NotFoundException('Service acceptance not found.');
  row.lines=(await c.query(`SELECT l.id,l.order_line_id AS "orderLineId",o.item_code AS "itemCode",o.item_name AS "itemName",l.quantity::text,l.value::text,l.expense_account_id AS "expenseAccountId",(l.quantity-coalesce((SELECT sum(i.quantity) FROM erp_trade_invoice_lines i JOIN erp_trade_invoices h ON h.id=i.invoice_id WHERE i.service_acceptance_line_id=l.id AND h.status='POSTED'),0))::text AS available FROM erp_service_acceptance_lines l JOIN erp_order_lines o ON o.id=l.order_line_id WHERE l.acceptance_id=$1 ORDER BY o.line_no`,[id])).rows;return row;
 }
 get(id:string){return this.books.read(c=>this.acceptance(c,id));}
 list(orderId:string,entryLagDays=0){return this.books.read(async c=>{const ids=(await c.query("SELECT id FROM erp_service_acceptances WHERE order_id=$1 AND greatest(0,(created_at AT TIME ZONE 'UTC')::date-date)>=$2 ORDER BY date,number",[orderId,entryLagDays])).rows;return Promise.all(ids.map(r=>this.acceptance(c,r.id)));});}
 create(user:User,input:ServiceAcceptanceInput,key:string){return this.books.write(user,key,'service-acceptance.create',input,'receipts.manage',async c=>{
  await this.books.openPeriod(c,input.date);
  const order=(await c.query('SELECT o.id,o.date::text,o.status,o.version,r.requester_id AS "requesterId" FROM erp_purchase_orders o JOIN erp_purchase_requests r ON r.id=o.request_id WHERE o.id=$1 FOR UPDATE OF o',[input.orderId])).rows[0];
  this.books.checkVersion(order,input.version);if(order.status!=='ISSUED')throw new ConflictException('Only an issued order can be accepted.');
  if(order.requesterId===user.id)throw new ForbiddenException('The requester cannot accept their own service.');
  if(input.date<order.date)throw new BadRequestException('Service acceptance cannot precede the order.');
  if((await c.query('SELECT $1::date>current_date AS future',[input.date])).rows[0].future)throw new BadRequestException('Service acceptance date cannot be in the future.');
  if(new Set(input.lines.map(line=>line.orderLineId)).size!==input.lines.length)throw new BadRequestException('Use one acceptance line per order line.');
  const id=randomUUID(),lines:{id:string;orderLineId:string;quantity:string;value:string;accountId:string}[]=[],entries:{accountId:string;amount:bigint}[]=[];let total=0n;
  for(const line of input.lines){
   const source=(await c.query(`SELECT o.id,o.item_kind,o.quantity::text,o.unit_price::text,o.service_expense_account_id AS "expenseAccountId",coalesce((SELECT sum(a.quantity) FROM erp_service_acceptance_lines a WHERE a.order_line_id=o.id),0)::text AS accepted,coalesce((SELECT sum(a.value) FROM erp_service_acceptance_lines a WHERE a.order_line_id=o.id),0)::text AS accepted_value FROM erp_order_lines o WHERE o.id=$1 AND o.order_id=$2`,[line.orderLineId,order.id])).rows[0];
   if(!source||source.item_kind!=='SERVICE'||!source.expenseAccountId)throw new ConflictException('Select service lines from this order.');
   const quantity=units(line.quantity,6),remainingQuantity=units(source.quantity,6)-units(source.accepted,6);if(quantity<=0n||quantity>remainingQuantity)throw new ConflictException('Service quantity exceeds the remaining unaccepted quantity.');
   const account=(await c.query('SELECT type,control,active FROM erp_accounts WHERE id=$1 FOR SHARE',[source.expenseAccountId])).rows[0];
   if(!account?.active||account.type!=='EXPENSE'||account.control!==null)throw new ConflictException('The approved service expense account must be an active non-control expense account.');
   const remainingValue=lineValue(source.quantity,source.unit_price)-units(source.accepted_value,2),amount=quantity===remainingQuantity?remainingValue:lineValue(line.quantity,source.unit_price);if(amount<=0n||amount>remainingValue)throw new BadRequestException('Accepted service value must be at least one paise and within the approved remaining value.');
   lines.push({id:randomUUID(),orderLineId:source.id,quantity:line.quantity,value:decimal(amount),accountId:source.expenseAccountId});entries.push({accountId:source.expenseAccountId,amount});total+=amount;
  }
  if(!lines.length)throw new BadRequestException('Enter at least one accepted service line.');
  const account=await controls(c);entries.push({accountId:account('GRNI'),amount:-total});
  const journal=await this.books.postSourceJournal(c,user,{source:'SERVICE_ACCEPTANCE',sourceId:id,date:input.date,description:`Service accepted: ${input.reference}`,lines:postingLines(entries)});
  await c.query('INSERT INTO erp_service_acceptances(id,order_id,date,reference,evidence,accepted_by,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,order.id,input.date,input.reference,input.evidence,user.id,journal.id]);
  for(const line of lines)await c.query('INSERT INTO erp_service_acceptance_lines(id,acceptance_id,order_line_id,quantity,value,expense_account_id) VALUES($1,$2,$3,$4,$5,$6)',[line.id,id,line.orderLineId,line.quantity,line.value,line.accountId]);
  await c.query('UPDATE erp_purchase_orders SET version=version+1 WHERE id=$1',[order.id]);
  await this.books.history(c,user,'purchase_order',{id:order.id,version:order.version+1},'service_accepted',{acceptanceId:id});
  const result=await this.acceptance(c,id);await this.books.history(c,user,'service_acceptance' as TradeHistoryKind,result,'posted');return result;
 });}
}
