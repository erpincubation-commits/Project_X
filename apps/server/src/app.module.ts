import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { AccessController } from './auth/access.controller';
import { PermissionsGuard } from './auth/permissions.guard';

@Controller('health')
class HealthController {
  constructor(private readonly database: DatabaseService) {}
  @Get() async health() {
    try { await this.database.pool.query('SELECT 1'); return { status: 'ready' }; }
    catch { throw new ServiceUnavailableException('The database is unavailable. Ask the administrator to check PostgreSQL.'); }
  }
}
@Module({
  controllers: [HealthController, AuthController, CustomersController, AccessController],
  providers: [DatabaseService, AuthService, AuthGuard, PermissionsGuard, CustomersService]
})
export class AppModule {}
