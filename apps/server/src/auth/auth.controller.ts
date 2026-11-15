import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { loginInput, setupInput, mfaInput } from '@erp/contracts';
import { parse } from '../common/validation';
import { AuthService } from './auth.service';
import { AuthGuard, AuthRequest } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('setup-status') setupStatus() { return this.auth.setupStatus(); }
  @Post('setup') setup(@Body() body: unknown) { const input = parse(setupInput, body); return this.auth.setup(input.email, input.password, input.setupToken); }
  @Post('mfa/verify') verify(@Body() body: unknown) { const input = parse(mfaInput, body); return this.auth.verifyMfa(input.challenge, input.code); }
  @Post('login') login(@Body() body: unknown) {
    const input = parse(loginInput, body);
    return this.auth.login(input.email, input.password);
  }
  @UseGuards(AuthGuard)
  @Get('me') me(@Req() request: AuthRequest) { return request.user; }
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @Post('logout') async logout(@Req() request: AuthRequest) { await this.auth.logout(request.token, request.user); return null; }
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @Post('revoke-sessions') async revoke(@Req() request: AuthRequest) { await this.auth.revokeSessions(request.user); }
}
