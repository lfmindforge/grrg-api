import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Override de la limite globale (100/10min) — 5 tentatives max sur 10 minutes
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.authService.login(dto);
    this.setRefreshCookie(res, refresh_token);
    return { access_token };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new UnauthorizedException('No refresh token');
    const { access_token, refresh_token } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refresh_token);
    return { access_token };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await this.authService.logout(token);
    res.clearCookie('refresh_token', { path: '/', sameSite: 'strict' });
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport intercepte cette route et redirige vers Google — NestJS n'atteint jamais ce corps
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // req.user contient { access_token, refresh_token } passé par GoogleStrategy.validate()
    const { access_token, refresh_token } = req.user as {
      access_token: string;
      refresh_token: string;
    };
    this.setRefreshCookie(res, refresh_token);
    return { access_token };
  }

  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    // Passport intercepte cette route et redirige vers GitHub — NestJS n'atteint jamais ce corps
  }

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  @HttpCode(HttpStatus.OK)
  async githubCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // req.user contient { access_token, refresh_token } passé par GitHubStrategy.validate()
    const { access_token, refresh_token } = req.user as {
      access_token: string;
      refresh_token: string;
    };
    this.setRefreshCookie(res, refresh_token);
    return { access_token };
  }

  // Centralise la configuration du cookie httpOnly pour éviter les répétitions
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: Number(this.config.get('JWT_REFRESH_EXPIRES_MS')),
      path: '/',
    });
  }
}
