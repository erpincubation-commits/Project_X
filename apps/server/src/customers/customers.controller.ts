import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { customerInput } from '@erp/contracts';
import { parse } from '../common/validation';
import { AuthGuard, AuthRequest } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() @RequirePermissions('customers.read') list(@Query('page') page: unknown = '1') { return this.customers.list(parse(z.coerce.number().int().min(1).max(100000), page)); }
  @Post() @RequirePermissions('customers.create') create(@Req() request: AuthRequest, @Body() body: unknown, @Headers('idempotency-key') key: unknown) {
    return this.customers.create(request.user, parse(customerInput, body), parse(z.uuid(), key));
  }
}
