import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { supplierInput, supplierUpdateInput, itemInput, itemUpdateInput, purchaseRequestInput, purchaseRequestUpdateInput, submitRequestInput, decideRequestInput, procurementPageInput } from '@erp/contracts';
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
  suppliers(@Req() req: AuthRequest,@Query() query: unknown) { return this.service.listMasters('supplier',req.user,parse(procurementPageInput,query)); }
  @Post('suppliers') @RequirePermissions('masters.manage')
  createSupplier(@Req() req: AuthRequest,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.createMaster('supplier',req.user,parse(supplierInput,body),id(key)); }
  @Patch('suppliers/:id') @RequirePermissions('masters.manage')
  updateSupplier(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.updateMaster('supplier',req.user,id(value),parse(supplierUpdateInput,body),id(key)); }
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
  @Get('requests/:id') @RequirePermissions('requests.read')
  request(@Req() req: AuthRequest,@Param('id') value: unknown) { return this.service.getRequest(req.user,id(value)); }
  @Post('requests') @RequirePermissions('requests.create')
  createRequest(@Req() req: AuthRequest,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.createRequest(req.user,parse(purchaseRequestInput,body),id(key)); }
  @Patch('requests/:id') @RequirePermissions('requests.create')
  updateRequest(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.updateRequest(req.user,id(value),parse(purchaseRequestUpdateInput,body),id(key)); }
  @Post('requests/:id/submit') @RequirePermissions('requests.create')
  submit(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.submit(req.user,id(value),parse(submitRequestInput,body),id(key)); }
  @Post('requests/:id/decide') @RequirePermissions('requests.decide')
  decide(@Req() req: AuthRequest,@Param('id') value: unknown,@Body() body: unknown,@Headers('idempotency-key') key: unknown) { return this.service.decide(req.user,id(value),parse(decideRequestInput,body),id(key)); }
  @Get('history/:kind/:id') @RequirePermissions('masters.read')
  history(@Req() req: AuthRequest,@Param('kind') kind: unknown,@Param('id') value: unknown) { return this.service.recordHistory(req.user,parse(z.enum(['supplier','item','purchase_request']),kind),id(value)); }
}
