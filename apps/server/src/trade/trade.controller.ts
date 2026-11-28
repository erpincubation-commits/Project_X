import {Body,Controller,Get,Headers,Param,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {z} from 'zod';
import {orderDescriptionAmendmentInput,orderAmendmentDecisionInput} from '@erp/contracts';
import {taxInput,taxUpdateInput,matchingPolicyUpdateInput,orderInput,orderCancelInput,orderAcknowledgementInput,orderListQuery,receiptInput,receiptListQuery,supplierInvoiceInput,supplierInvoiceUpdateInput,supplierInvoiceQuery,resolveInvoiceInput,assignInvoiceExceptionInput,customerInvoiceInput,customerInvoiceUpdateInput,paymentInput,paymentUpdateInput,paymentDecisionInput,paymentExecutionInput,collectionInput,tradePageInput,paymentListQuery,statementQueryInput,postJournalInput,cutoffInput} from '@erp/contracts';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {PermissionsGuard,RequirePermissions,RequireAnyPermission} from '../auth/permissions.guard';
import {parse} from '../common/validation';
import {TradeService} from './trade.service';
import {SettlementService} from './settlement.service';
import {ReportsService} from './reports.service';
const uuid=(v:unknown)=>parse(z.uuid(),v),page=(q:unknown)=>parse(tradePageInput,q).page;
@Controller('trade')
@UseGuards(AuthGuard,PermissionsGuard)
export class TradeController{
 constructor(private readonly trade:TradeService,private readonly payments:SettlementService,private readonly reports:ReportsService){}
 @Get('matching-policy') @RequirePermissions('books.read') matchingPolicy(){return this.trade.getMatchingPolicy();}
 @Patch('matching-policy') @RequirePermissions('books.setup') updateMatchingPolicy(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.updateMatchingPolicy(r.user,parse(matchingPolicyUpdateInput,b),uuid(k));}
 @Get('taxes') @RequirePermissions('books.read') taxes(){return this.trade.listTaxes();}
 @Post('taxes') @RequirePermissions('tax.manage') tax(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.createTax(r.user,parse(taxInput,b),uuid(k));}
 @Patch('taxes/:id') @RequirePermissions('tax.manage') updateTax(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.updateTax(r.user,uuid(id),parse(taxUpdateInput,b),uuid(k));}
 @Get('orders') @RequirePermissions('orders.read') orders(@Query() q:unknown){const query=parse(orderListQuery,q);return this.trade.listOrders(query.page,query);}
 @Post('orders/:id/description-amendment') @RequirePermissions('orders.manage') proposeAmendment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.proposeOrderAmendment(r.user,uuid(id),parse(orderDescriptionAmendmentInput,b),uuid(k));}
 @Post('orders/:id/description-amendment/decision') @RequirePermissions('requests.decide') decideAmendment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.decideOrderAmendment(r.user,uuid(id),parse(orderAmendmentDecisionInput,b),uuid(k));}
 @Get('orders/:id') @RequirePermissions('orders.read') order(@Param('id') id:unknown){return this.trade.getOrder(uuid(id));}
 @Get('orders/:id/receipts') @RequirePermissions('orders.read') orderReceipts(@Param('id') id:unknown){return this.trade.orderReceipts(uuid(id));}
 @Post('orders') @RequirePermissions('orders.manage') createOrder(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.createOrder(r.user,parse(orderInput,b),uuid(k));}
 @Post('orders/:id/cancel') @RequirePermissions('orders.manage') cancelOrder(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.cancelOrder(r.user,uuid(id),parse(orderCancelInput,b),uuid(k));}
 @Post('orders/:id/acknowledgement') @RequirePermissions('orders.manage') acknowledgeOrder(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.acknowledgeOrder(r.user,uuid(id),parse(orderAcknowledgementInput,b),uuid(k));}
 @Get('receipts') @RequirePermissions('orders.read') receipts(@Query() q:unknown){const query=parse(receiptListQuery,q);return this.trade.listReceipts(query.page,query.search,query.damagedOnly==='true',Number(query.entryLagDays));}
 @Get('receipts/:id') @RequirePermissions('orders.read') receipt(@Param('id') id:unknown){return this.trade.getReceipt(uuid(id));}
 @Post('receipts') @RequirePermissions('receipts.manage') createReceipt(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.createReceipt(r.user,parse(receiptInput,b),uuid(k));}
 @Get('supplier-invoices') @RequireAnyPermission('payables.read','invoice.resolve') invoices(@Req() r:AuthRequest,@Query() q:unknown){const query=parse(supplierInvoiceQuery,q);return this.trade.listInvoices(r.user,query.page,'AP',query);}
 @Get('supplier-invoices/exception-reviewers') @RequirePermissions('payables.manage') exceptionReviewers(){return this.trade.listInvoiceExceptionReviewers();}
 @Get('supplier-invoices/:id') @RequireAnyPermission('payables.read','invoice.resolve') invoice(@Req() r:AuthRequest,@Param('id') id:unknown){return this.trade.getInvoice(r.user,uuid(id),'AP');}
 @Post('supplier-invoices') @RequirePermissions('payables.manage') createInvoice(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.createInvoice(r.user,parse(supplierInvoiceInput,b),'AP',uuid(k));}
 @Patch('supplier-invoices/:id') @RequirePermissions('payables.manage') updateInvoice(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.updateInvoice(r.user,uuid(id),parse(supplierInvoiceUpdateInput,b),'AP',uuid(k));}
 @Post('supplier-invoices/:id/match') @RequirePermissions('payables.manage') match(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.matchInvoice(r.user,uuid(id),parse(postJournalInput,b),uuid(k));}
 @Post('supplier-invoices/:id/assign-exception') @RequirePermissions('payables.manage') assignException(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.assignInvoiceException(r.user,uuid(id),parse(assignInvoiceExceptionInput,b),uuid(k));}
 @Post('supplier-invoices/:id/resolve') @RequirePermissions('invoice.resolve') resolve(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.resolveInvoice(r.user,uuid(id),parse(resolveInvoiceInput,b),uuid(k));}
 @Post('supplier-invoices/:id/post') @RequirePermissions('payables.manage') postInvoice(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.postInvoice(r.user,uuid(id),parse(postJournalInput,b),'AP',uuid(k));}
 @Get('customer-invoices') @RequirePermissions('books.read') customerInvoices(@Req() r:AuthRequest,@Query() q:unknown){return this.trade.listInvoices(r.user,page(q),'AR');}
 @Get('customer-invoices/:id') @RequirePermissions('books.read') customerInvoice(@Req() r:AuthRequest,@Param('id') id:unknown){return this.trade.getInvoice(r.user,uuid(id),'AR');}
 @Post('customer-invoices') @RequirePermissions('receivables.manage') createCustomerInvoice(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.createInvoice(r.user,parse(customerInvoiceInput,b),'AR',uuid(k));}
 @Patch('customer-invoices/:id') @RequirePermissions('receivables.manage') updateCustomerInvoice(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.updateInvoice(r.user,uuid(id),parse(customerInvoiceUpdateInput,b),'AR',uuid(k));}
 @Post('customer-invoices/:id/post') @RequirePermissions('receivables.manage') postCustomerInvoice(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.postInvoice(r.user,uuid(id),parse(postJournalInput,b),'AR',uuid(k));}
 @Post('invoices/:id/void') @RequireAnyPermission('payables.manage','receivables.manage') voidInvoice(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.trade.voidInvoice(r.user,uuid(id),parse(orderCancelInput,b),uuid(k));}
 @Get('payments') @RequirePermissions('payments.read') paymentList(@Req() r:AuthRequest,@Query() q:unknown){const query=parse(paymentListQuery,q);return this.payments.listPayments(r.user,query.page,query.pendingOnly==='true',query);}
 @Get('payments/approvers') @RequirePermissions('payments.manage') approvers(@Req() r:AuthRequest){return this.payments.approvers(r.user);}
 @Get('payments/:id') @RequirePermissions('payments.read') payment(@Req() r:AuthRequest,@Param('id') id:unknown){return this.payments.getPayment(r.user,uuid(id));}
 @Post('payments') @RequirePermissions('payments.manage') createPayment(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.create(r.user,parse(paymentInput,b),uuid(k));}
 @Patch('payments/:id') @RequirePermissions('payments.manage') updatePayment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.update(r.user,uuid(id),parse(paymentUpdateInput,b),uuid(k));}
 @Post('payments/:id/submit') @RequirePermissions('payments.manage') submitPayment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.submit(r.user,uuid(id),parse(postJournalInput,b),uuid(k));}
 @Post('payments/:id/decide') @RequirePermissions('payments.decide') decidePayment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.decide(r.user,uuid(id),parse(paymentDecisionInput,b),uuid(k));}
 @Post('payments/:id/execute') @RequirePermissions('payments.manage') executePayment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.execute(r.user,uuid(id),parse(paymentExecutionInput,b),uuid(k));}
 @Post('payments/:id/cancel') @RequirePermissions('payments.manage') cancelPayment(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.cancel(r.user,uuid(id),parse(orderCancelInput,b),uuid(k));}
 @Get('collections') @RequirePermissions('books.read') collections(@Query() q:unknown){return this.payments.listCollections(page(q));}
 @Post('collections') @RequirePermissions('receivables.manage') createCollection(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.payments.createCollection(r.user,parse(collectionInput,b),uuid(k));}
 @Get('subledgers') @RequirePermissions('books.read') subledgers(@Query() q:unknown){return this.reports.subledgers(parse(cutoffInput,q).date);}
 @Get('statements') @RequirePermissions('books.read') statements(@Query() q:unknown){const range=parse(statementQueryInput,q);return this.reports.statements(range.from,range.to);}
 @Get('history/:kind/:id') @RequireAnyPermission('orders.read','books.read','payments.read','invoice.resolve') history(@Req() r:AuthRequest,@Param('kind') kind:unknown,@Param('id') id:unknown){const type=parse(z.enum(['tax','purchase_order','goods_receipt','service_acceptance','supplier_invoice','customer_invoice','payment','collection']),kind);return type==='payment'?this.payments.history(r.user,uuid(id)):this.trade.history(r.user,type,uuid(id));}
}
