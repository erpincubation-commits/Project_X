import { Body, Controller, Get, Header, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { importInput, importCommitInput, privacyInput, privacyActionInput } from '@erp/contracts';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { parse } from '../common/validation';
import { OperationsService } from './operations.service';
const uuid=(v:unknown)=>parse(z.uuid(),v);
@Controller('operations') @UseGuards(AuthGuard,PermissionsGuard)
export class OperationsController {
 constructor(private readonly service:OperationsService){}
 @Post('imports/preview') @RequirePermissions('imports.manage') preview(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.preview(r.user,parse(importInput,b),uuid(k));}
 @Post('imports/:id/commit') @RequirePermissions('imports.manage') commit(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.commit(r.user,uuid(id),parse(importCommitInput,b).digest,uuid(k));}
 @Get('privacy') @RequirePermissions('privacy.manage') list(@Query() q:unknown){return this.service.listCases(parse(z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict(),q).page);}
 @Post('privacy') @RequirePermissions('privacy.manage') create(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createCase(r.user,parse(privacyInput,b),uuid(k));}
 @Post('privacy/:id/action') @RequirePermissions('privacy.manage') action(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.action(r.user,uuid(id),parse(privacyActionInput,b),uuid(k));}
 @Post('privacy/:id/export') @Header('Cache-Control','no-store') @RequirePermissions('privacy.manage') export(@Req() r:AuthRequest,@Param('id') id:unknown){return this.service.exportCase(r.user,uuid(id));}
}
