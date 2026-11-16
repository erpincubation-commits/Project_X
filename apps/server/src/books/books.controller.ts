import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { booksSetupInput, accountInput, accountUpdateInput, periodInput, periodStateInput, journalInput, journalUpdateInput, postJournalInput, reverseJournalInput, warehouseInput, warehouseUpdateInput, stockMovementInput, booksQueryInput, cutoffInput, bankReconciliationInput, bankReconciliationUpdateInput, bankMatchInput } from '@erp/contracts';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions, RequireAnyPermission } from '../auth/permissions.guard';
import { parse } from '../common/validation';
import { BooksService } from './books.service';
const uuid=(v:unknown)=>parse(z.uuid(),v);
@Controller('books')
@UseGuards(AuthGuard,PermissionsGuard)
export class BooksController {
 constructor(private readonly service:BooksService){}
 @Get() @RequireAnyPermission('books.read','inventory.read') overview(@Req() r:AuthRequest){return this.service.getOverview(r.user);}
 @Post('setup') @RequirePermissions('books.setup') setup(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.setup(r.user,parse(booksSetupInput,b),uuid(k));}
 @Post('accounts') @RequirePermissions('books.manage') account(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createAccount(r.user,parse(accountInput,b),uuid(k));}
 @Patch('accounts/:id') @RequirePermissions('books.manage') updateAccount(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.updateAccount(r.user,uuid(id),parse(accountUpdateInput,b),uuid(k));}
 @Post('periods') @RequirePermissions('books.manage') period(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createPeriod(r.user,parse(periodInput,b),uuid(k));}
 @Post('periods/:id/state') @RequirePermissions('books.manage') state(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.setPeriod(r.user,uuid(id),parse(periodStateInput,b),uuid(k));}
 @Get('journals') @RequirePermissions('books.read') journals(@Query() q:unknown){return this.service.listJournals(parse(booksQueryInput,q).page);}
 @Get('journals/:id') @RequirePermissions('books.read') journal(@Param('id') id:unknown){return this.service.getJournal(uuid(id));}
 @Post('journals') @RequirePermissions('books.manage') createJournal(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createJournal(r.user,parse(journalInput,b),uuid(k));}
 @Patch('journals/:id') @RequirePermissions('books.manage') updateJournal(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.updateJournal(r.user,uuid(id),parse(journalUpdateInput,b),uuid(k));}
 @Post('journals/:id/post') @RequirePermissions('journals.post') post(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.postJournal(r.user,uuid(id),parse(postJournalInput,b),uuid(k));}
 @Post('journals/:id/reverse') @RequirePermissions('journals.post') reverse(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.reverseJournal(r.user,uuid(id),parse(reverseJournalInput,b),uuid(k));}
 @Post('warehouses') @RequirePermissions('inventory.manage') warehouse(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createWarehouse(r.user,parse(warehouseInput,b),uuid(k));}
 @Patch('warehouses/:id') @RequirePermissions('inventory.manage') updateWarehouse(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.updateWarehouse(r.user,uuid(id),parse(warehouseUpdateInput,b),uuid(k));}
 @Get('movements') @RequirePermissions('inventory.read') movements(@Query() q:unknown){return this.service.listMovements(parse(booksQueryInput,q).page);}
 @Post('movements') @RequirePermissions('inventory.manage') move(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.postMovement(r.user,parse(stockMovementInput,b),uuid(k));}
 @Get('valuation') @RequirePermissions('inventory.read') valuation(@Query() q:unknown){return this.service.stockReconciliation(parse(cutoffInput,q).date);}
 @Get('trial-balance') @RequirePermissions('books.read') trial(@Query() q:unknown){return this.service.trialBalance(parse(cutoffInput,q).date);}
 @Get('bank-reconciliations') @RequirePermissions('books.read') banks(@Query() q:unknown){return this.service.listBanks(parse(booksQueryInput,q).page);}
 @Get('bank-reconciliations/:id') @RequirePermissions('books.read') bank(@Param('id') id:unknown){return this.service.getBank(uuid(id));}
 @Post('bank-reconciliations') @RequirePermissions('books.manage') createBank(@Req() r:AuthRequest,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.createBank(r.user,parse(bankReconciliationInput,b),uuid(k));}
 @Post('bank-reconciliations/:id/match') @RequirePermissions('books.manage') match(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.matchBank(r.user,uuid(id),parse(bankMatchInput,b),uuid(k));}
 @Patch('bank-reconciliations/:id') @RequirePermissions('books.manage') updateBank(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.updateBank(r.user,uuid(id),parse(bankReconciliationUpdateInput,b),uuid(k));}
 @Post('bank-reconciliations/:id/finalise') @RequirePermissions('books.manage') finalise(@Req() r:AuthRequest,@Param('id') id:unknown,@Body() b:unknown,@Headers('idempotency-key') k:unknown){return this.service.finaliseBank(r.user,uuid(id),parse(postJournalInput,b),uuid(k));}
 @Get('history/:kind/:id') @RequireAnyPermission('books.read','inventory.read') history(@Req() r:AuthRequest,@Param('kind') kind:unknown,@Param('id') id:unknown){return this.service.historyRecords(r.user,parse(z.enum(['books','account','period','journal','warehouse','stock_movement','bank_reconciliation']),kind),uuid(id));}
}
