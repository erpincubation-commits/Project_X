import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@erp/contracts';
import { AuthService } from './auth.service';

export type AuthRequest = Request & { user: User; token: string };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Sign in to access the workspace.');
    request.token = match[1];
    request.user = await this.auth.authenticate(request.token);
    return true;
  }
}
