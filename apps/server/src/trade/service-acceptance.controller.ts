import {Body,Controller,Get,Headers,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {z} from 'zod';
import {serviceAcceptanceInput,serviceAcceptanceLagQuery} from '@erp/contracts';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {PermissionsGuard,RequirePermissions} from '../auth/permissions.guard';
import {parse} from '../common/validation';
import {ServiceAcceptanceService} from './service-acceptance.service';
const uuid=(value:unknown)=>parse(z.uuid(),value);
@Controller('trade')
@UseGuards(AuthGuard,PermissionsGuard)
export class ServiceAcceptanceController {
 constructor(private readonly service:ServiceAcceptanceService){}
 @Get('orders/:id/service-acceptances') @RequirePermissions('orders.read') list(@Param('id') id:unknown,@Query() q:unknown){return this.service.list(uuid(id),Number(parse(serviceAcceptanceLagQuery,q).entryLagDays));}
 @Get('service-acceptances/:id') @RequirePermissions('orders.read') get(@Param('id') id:unknown){return this.service.get(uuid(id));}
 @Post('service-acceptances') @RequirePermissions('receipts.manage') create(@Req() req:AuthRequest,@Body() body:unknown,@Headers('idempotency-key') key:unknown){return this.service.create(req.user,parse(serviceAcceptanceInput,body),uuid(key));}
}
