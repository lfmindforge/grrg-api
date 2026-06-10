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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // 10 inscriptions max sur 10 minutes par IP — anti abus de création de comptes
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({ summary: 'Créer un compte email/mot de passe' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 5 tentatives max sur 10 minutes par IP — anti brute-force mot de passe
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({ summary: 'Connexion email/mot de passe' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.authService.login(dto);
    this.setRefreshCookie(res, refresh_token);
    this.setAccessCookie(res, access_token);
    return { access_token };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler le access token via le refresh token cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new UnauthorizedException('No refresh token');
    const { access_token, refresh_token } =
      await this.authService.refresh(token);
    this.setRefreshCookie(res, refresh_token);
    this.setAccessCookie(res, access_token);
    return { access_token };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Déconnexion — révoque le refresh token et efface les cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await this.authService.logout(token);
    res.clearCookie('refresh_token', {
      path: '/',
      sameSite:
        this.config.get('NODE_ENV') === 'production' ? 'none' : 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
    });
    res.clearCookie('access_token', {
      path: '/',
      sameSite: this.config.get('NODE_ENV') === 'production' ? 'none' : 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
    });
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirection vers Google OAuth' })
  googleAuth() {
    // Passport intercepte cette route et redirige vers Google — NestJS n'atteint jamais ce corps
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    // req.user contient { access_token, refresh_token } ou { error: 'email_conflict' }
    const user = req.user as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    if (user.error) {
      return res.redirect(`${frontendUrl}/login?error=${user.error}`);
    }
    this.setRefreshCookie(res, user.refresh_token!);
    this.setAccessCookie(res, user.access_token!);
    return res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Redirection vers GitHub OAuth' })
  githubAuth() {
    // Passport intercepte cette route et redirige vers GitHub — NestJS n'atteint jamais ce corps
  }

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    // req.user contient { access_token, refresh_token } ou { error: 'email_conflict' }
    const user = req.user as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    if (user.error) {
      return res.redirect(`${frontendUrl}/login?error=${user.error}`);
    }
    this.setRefreshCookie(res, user.refresh_token!);
    this.setAccessCookie(res, user.access_token!);
    return res.redirect(`${frontendUrl}/auth/callback`);
  }

  // Centralise la configuration du cookie httpOnly pour éviter les répétitions
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite:
        this.config.get('NODE_ENV') === 'production' ? 'none' : 'strict',
      maxAge: Number(this.config.get('JWT_REFRESH_EXPIRES_MS')),
      path: '/',
    });
  }

  private setAccessCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: this.config.get('NODE_ENV') === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  }
}
