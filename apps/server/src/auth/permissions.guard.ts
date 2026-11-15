import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@erp/contracts';
import type { AuthRequest } from './auth.guard';
import { AuthService } from './auth.service';

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata('erp.permissions', permissions);
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>('erp.permissions', [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (required?.every(permission => request.user?.permissions.includes(permission))) return true;
    await this.auth.denied(request.user, required || []);
    throw new ForbiddenException('Your account does not have permission to perform this action.');
  }
}
