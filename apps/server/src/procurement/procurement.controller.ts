import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {approvalCyclesQuery} from '@erp/contracts';
import { supplierInput, supplierUpdateInput, supplierDuplicateQuery, supplierPageInput, supplierQualificationInput, supplierQualificationDecision, itemInput, itemUpdateInput, purchaseRequestInput, purchaseRequestUpdateInput, submitRequestInput, handoffRequestInput, withdrawRequestInput, decideRequestInput, procurementPageInput, approvalWorkloadQuery, supplierQuoteInput, withdrawQuoteInput, recommendQuoteInput } from '@erp/contracts';
import { AuthGuard, AuthRequest } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { parse } from '../common/validation';
import { ProcurementService } from './procurement.service';

const id = (value: unknown) => parse(z.uuid(),value);
@Controller('procurement')
@UseGuards(AuthGuard,PermissionsGuard)
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}
  @Get('suppliers') @RequirePermissions('masters.read')
  suppliers(@Req() req: AuthRequest,@Query() query: unknown) { return this.service.listMasters('supplier',req.user,parse(supplierPageInput,query)); }
  @Get('suppliers/possible-duplicates') @RequirePermissions('masters.manage')
  supplierDuplicates(@Query() query:unknown) { return this.service.findSupplierDuplicates(parse(supplierDuplicateQuery,query)); }
  @Post('suppliers/duplicate-check') @RequirePermissions('masters.manage')
  supplierDuplicateCheck(@Body() body:unknown) { return this.service.findSupplierDuplicates(parse(supplierDuplicateQuery,body)); }
  @Post('suppliers') @RequirePermissions('masters.manage')
  createSupplier(@Req() req: AuthRequest,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.createMaster('supplier',req.user,parse(supplierInput,body),id(key)); }
  @Patch('suppliers/:id') @RequirePermissions('masters.manage')
  updateSupplier(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.updateMaster('supplier',req.user,id(value),parse(supplierUpdateInput,body),id(key)); }
  @Get('suppliers/:id/qualification') @RequirePermissions('masters.history')
  supplierQualification(@Param('id') value:unknown) { return this.service.getSupplierQualification(id(value)); }
  @Post('suppliers/:id/qualification') @RequirePermissions('masters.manage')
  submitSupplierQualification(@Req() req:AuthRequest,@Param('id') value:unknown,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.submitSupplierQualification(req.user,id(value),parse(supplierQualificationInput,body),id(key)); }
  @Post('suppliers/:id/qualification/decision') @RequirePermissions('users.manage')
  decideSupplierQualification(@Req() req:AuthRequest,@Param('id') value:unknown,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.decideSupplierQualification(req.user,id(value),parse(supplierQualificationDecision,body),id(key)); }
  @Get('items') @RequirePermissions('masters.read')
  items(@Req() req: AuthRequest,@Query() query: unknown) { return this.service.listMasters('item',req.user,parse(procurementPageInput,query)); }
  @Post('items') @RequirePermissions('masters.manage')
  createItem(@Req() req: AuthRequest,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.createMaster('item',req.user,parse(itemInput,body),id(key)); }
  @Patch('items/:id') @RequirePermissions('masters.manage')
  updateItem(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.updateMaster('item',req.user,id(value),parse(itemUpdateInput,body),id(key)); }
  @Get('approvers') @RequirePermissions('requests.create')
  approvers(@Req() req: AuthRequest) { return this.service.approvers(req.user); }
  @Get('requests') @RequirePermissions('requests.read')
  requests(@Req() req: AuthRequest,@Query() query: unknown) { return this.service.listRequests(req.user,parse(procurementPageInput,query)); }
  @Get('request-overview') @RequirePermissions('requests.read')
  overview(@Req() req: AuthRequest) { return this.service.requestOverview(req.user); }
  @Get('approval-workload') @RequirePermissions('requests.read.all')
  approvalWorkload(@Query() query:unknown) { return this.service.approvalWorkload(parse(approvalWorkloadQuery,query)); }
  @Get('approval-holding') @RequirePermissions('requests.read.all')
  approvalHolding(@Query() query:unknown) { return this.service.approvalHolding(parse(approvalCyclesQuery,query)); }
  @Get('approval-cycles') @RequirePermissions('requests.read.all')
  approvalCycles(@Query() query:unknown) { return this.service.approvalCycles(parse(approvalCyclesQuery,query)); }
  @Get('requests/:id') @RequirePermissions('requests.read')
  request(@Req() req: AuthRequest,@Param('id') value: unknown) { return this.service.getRequest(req.user,id(value)); }
  @Get('requests/:id/quotes') @RequirePermissions('masters.history')
  quotes(@Param('id') value:unknown) { return this.service.listQuotes(id(value)); }
  @Get('requests/:id/quote-recommendations') @RequirePermissions('masters.history')
  quoteRecommendations(@Param('id') value:unknown) { return this.service.listQuoteRecommendations(id(value)); }
  @Post('quotes') @RequirePermissions('orders.manage')
  createQuote(@Req() req:AuthRequest,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.createQuote(req.user,parse(supplierQuoteInput,body),id(key)); }
  @Post('quotes/:id/withdraw') @RequirePermissions('orders.manage')
  withdrawQuote(@Req() req:AuthRequest,@Param('id') value:unknown,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.withdrawQuote(req.user,id(value),parse(withdrawQuoteInput,body),id(key)); }
  @Post('quotes/:id/recommend') @RequirePermissions('orders.manage')
  recommendQuote(@Req() req:AuthRequest,@Param('id') value:unknown,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.recommendQuote(req.user,id(value),parse(recommendQuoteInput,body),id(key)); }
  @Post('requests') @RequirePermissions('requests.create')
  createRequest(@Req() req: AuthRequest,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.createRequest(req.user,parse(purchaseRequestInput,body),id(key)); }
  @Patch('requests/:id') @RequirePermissions('requests.create')
  updateRequest(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.updateRequest(req.user,id(value),parse(purchaseRequestUpdateInput,body),id(key)); }
  @Post('requests/:id/submit') @RequirePermissions('requests.create')
  submit(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.submit(req.user,id(value),parse(submitRequestInput,body),id(key)); }
  @Post('requests/:id/withdraw') @RequirePermissions('requests.create')
  withdraw(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.withdraw(req.user,id(value),parse(withdrawRequestInput,body),id(key)); }
  @Post('requests/:id/reassign') @RequirePermissions('requests.create')
  reassign(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.reassign(req.user,id(value),parse(submitRequestInput,body),id(key)); }
  @Post('requests/:id/handoff') @RequirePermissions('requests.decide')
  handoff(@Req() req:AuthRequest,@Param('id') value:unknown,@Body() body:unknown,@Headers('idempotency-key') key:unknown) { return this.service.handoff(req.user,id(value),parse(handoffRequestInput,body),id(key)); }
  @Post('requests/:id/decide') @RequirePermissions('requests.decide')
  decide(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.decide(req.user,id(value),parse(decideRequestInput,body),id(key)); }
  @Get('history/:kind/:id') @RequirePermissions('masters.read')
  history(@Req() req: AuthRequest,@Param('kind') kind: unknown,@Param('id') value: unknown) { return this.service.recordHistory(req.user,parse(z.enum(['supplier','item','purchase_request']),kind),id(value)); }
}
