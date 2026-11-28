import { RecoveryController } from './auth/recovery.controller';
import { OperationsController } from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { AccessController } from './auth/access.controller';
import { PermissionsGuard } from './auth/permissions.guard';
import { ProcurementController } from './procurement/procurement.controller';
import { ProcurementService } from './procurement/procurement.service';
import { BooksController } from './books/books.controller';
import { BooksService } from './books/books.service';
import {TradeService} from './trade/trade.service';
import {SettlementService} from './trade/settlement.service';
import {ReportsService} from './trade/reports.service';
import {TradeController} from './trade/trade.controller';
import {ServiceAcceptanceController} from './trade/service-acceptance.controller';
import {ServiceAcceptanceService} from './trade/service-acceptance.service';

@Controller('health')
class HealthController {
  constructor(private readonly database: DatabaseService) {}
  @Get() async health() {
    try { await this.database.pool.query('SELECT 1'); return { status: 'ready' }; }
    catch { throw new ServiceUnavailableException('The database is unavailable. Ask the administrator to check PostgreSQL.'); }
  }
}
@Module({
  controllers: [HealthController, AuthController, RecoveryController, CustomersController, AccessController, ProcurementController, BooksController,TradeController,ServiceAcceptanceController,OperationsController],
  providers: [DatabaseService, AuthService, AuthGuard, PermissionsGuard, CustomersService, ProcurementService, BooksService,TradeService,SettlementService,ReportsService,OperationsService,ServiceAcceptanceService]
})
export class AppModule {}
