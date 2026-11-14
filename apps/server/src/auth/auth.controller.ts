import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { loginInput } from '@erp/contracts';
import { parse } from '../common/validation';
import { AuthService } from './auth.service';
import { AuthGuard, AuthRequest } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') login(@Body() body: unknown) {
    const input = parse(loginInput, body);
    return this.auth.login(input.email, input.password);
  }
  @UseGuards(AuthGuard)
  @Get('me') me(@Req() request: AuthRequest) { return request.user; }
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @Post('logout') async logout(@Req() request: AuthRequest) { await this.auth.logout(request.token); return null; }
}
