import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';
//type auto de la lib ms utilisé par la lib jwt permet de typer correctement les string représentant des durées. car la lib ms parse ces string.
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.userService.findByEmail(dto.email);
    if (existingEmail) throw new ConflictException('Email already in use');

    const existingPseudo = await this.userService.findByPseudo(dto.pseudo);
    if (existingPseudo) throw new ConflictException('Pseudo already in use');

    // Verification de l'age légal à la date du jour (18 ans)
    const birthdate = new Date(dto.birthdate);
    const today = new Date();
    const age =
      today.getFullYear() -
      birthdate.getFullYear() -
      (today <
      new Date(today.getFullYear(), birthdate.getMonth(), birthdate.getDate())
        ? 1
        : 0);
    if (age < 18)
      throw new UnprocessableEntityException(
        'You must be at least 18 years old',
      );

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.create({
      email: dto.email,
      password_hash,
      pseudo: dto.pseudo,
      birthdate,
    });

    // Exclure le mot de passe de la réponse et copie le reste
    const { password_hash: _, ...publicUser } = user;
    return publicUser;
  }

  async login(
    dto: LoginDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.password_hash)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refresh(
    token: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    let payload: { sub: string; email: string; jti: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.refreshTokenRepo.findOne({
      where: { id: payload.jti },
    });
    // Si absent en DB: token révoqué ou réutilisation suspecte (vol)
    if (!record) throw new UnauthorizedException('Refresh token revoked');

    // Rotation: révoque l'ancien jti, émet deux nouveaux tokens
    await this.refreshTokenRepo.delete({ id: payload.jti });

    // Aller DB pour récupérer le rôle courant — garantit qu'un changement de rôle prend effet au prochain refresh
    const user = await this.userService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return this.generateTokens(user.id, user.email, user.role);
  }

  /**  La colonne est stockée en DB mais lors du refresh(), seul findOne({ id: jti }) est vérifié. L'expiration est déjà
  gérée par jwtService.verify qui rejette les tokens expirés. expires_at en DB est donc redondant mais pas inutile — il
  permet un futur job de nettoyage des tokens orphelins. C'est acceptable, mais à connaître si on te pose la question. */

  /** getOrThrow lève une exception au démarrage si la variable est absente du .env, ce qui est le comportement voulu —
  mieux vaut crasher au boot que d'avoir une erreur silencieuse en production. */

  async logout(token: string): Promise<void> {
    let payload: { jti: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // Token invalide ou expiré: rien à révoqué, logout réussi.
      return;
    }
    await this.refreshTokenRepo.delete({ id: payload.jti });
  }

  async findOrCreateOAuthUser(profile: {
    provider: 'google' | 'github';
    oauthId: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
  }): Promise<{ access_token: string; refresh_token: string }> {
    //normalise l'email car l'oauth github met une mauscule => 2 compte avec meme email possible=> pas bon.
    const email = profile.email.toLowerCase();
    // Cas 1 : compte OAuth déjà existant
    const existing = await this.userService.findByOAuthId(
      profile.provider,
      profile.oauthId,
    );
    if (existing) return this.generateTokens(existing.id, existing.email, existing.role);

    // Cas 2 : email déjà utilisé par un compte email/mot de passe
    const byEmail = await this.userService.findByEmail(email);
    if (byEmail)
      throw new ConflictException(
        'An account already exists with this email. Please log in with your password.',
      );

    // Cas 3 : nouveau compte OAuth
    const pseudo = this.generatePseudo(profile.displayName);
    const user = await this.userService.create({
      email,
      password_hash: null,
      pseudo,
      birthdate: null,
      avatar_url: profile.avatarUrl ?? null,
      oauth_provider: profile.provider,
      oauth_id: profile.oauthId,
    });
    return this.generateTokens(user.id, user.email, user.role);
  }

  // Génère un pseudo depuis le displayName OAuth avec suffixe hex pour garantir l'unicité
  private generatePseudo(displayName: string): string {
    const base =
      displayName
        .split(' ')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) || 'user';
    const suffix = randomBytes(2).toString('hex');
    return `${base}_${suffix}`;
  }

  // Génération des token + persiste le jti en DB.
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const jti = randomUUID();
    const expiresAt = new Date(
      //.env stock tout en string sans le parse number on auraitu ne concate au lieu d'un calcule
      Date.now() + Number(this.config.get('JWT_REFRESH_EXPIRES_MS')),
    );

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          expiresIn: this.config.getOrThrow<StringValue>(
            'JWT_ACCESS_EXPIRES_IN',
          ),
        },
      ),

      // Le payload du refresh inclut email pour éviter un aller en DB lors du refresh
      this.jwtService.signAsync(
        { sub: userId, email, jti },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.getOrThrow<StringValue>(
            'JWT_REFRESH_EXPIRES_IN',
          ),
        },
      ),
    ]);

    await this.refreshTokenRepo.save({
      id: jti,
      user_id: userId,
      expires_at: expiresAt,
    });
    return { access_token, refresh_token };
  }
}
