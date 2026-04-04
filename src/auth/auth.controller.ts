import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refresh_token);
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
  googleCallback(@Req() req: Request) {
    // req.user contient { access_token, refresh_token } passé par GoogleStrategy.validate()
    return req.user;
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
  githubCallback(@Req() req: Request) {
    // req.user contient { access_token, refresh_token } passé par GitHubStrategy.validate()
    return req.user;
  }
}
