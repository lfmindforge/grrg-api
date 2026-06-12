import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { User } from '../../user/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Fallback cookie — utilisé uniquement par EventSource (SSE ne supporte pas les headers custom)
        (req: Request) => (req?.cookies as Record<string, string>)?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'banned_until'],
    });

    if (user?.banned_until && new Date(user.banned_until) > new Date()) {
      throw new ForbiddenException('Compte suspendu');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
