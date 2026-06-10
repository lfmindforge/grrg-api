import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { WishModule } from './wish/wish.module';
import { DonationModule } from './donation/donation.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { FollowModule } from './follow/follow.module';
import { CommentModule } from './comment/comment.module';
import { ReactionModule } from './reaction/reaction.module';
import { FeedModule } from './feed/feed.module';
import { BadgeModule } from './badge/badge.module';
import { EventLogModule } from './event-log/event-log.module';
import { HealthModule } from './health/health.module';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL:                      Joi.string().required(),
        JWT_SECRET:                        Joi.string().required(),
        JWT_REFRESH_SECRET:                Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN:             Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN:            Joi.string().default('7d'),
        JWT_REFRESH_EXPIRES_MS:            Joi.number().default(604800000),
        GOOGLE_CLIENT_ID:                  Joi.string().required(),
        GOOGLE_CLIENT_SECRET:              Joi.string().required(),
        GOOGLE_CALLBACK_URL:               Joi.string().required(),
        GITHUB_CLIENT_ID:                  Joi.string().required(),
        GITHUB_CLIENT_SECRET:              Joi.string().required(),
        GITHUB_CALLBACK_URL:               Joi.string().required(),
        SUPABASE_URL:                      Joi.string().required(),
        SUPABASE_SERVICE_ROLE_KEY:         Joi.string().required(),
        SUPABASE_BUCKET_WISHES:            Joi.string().default('wishes-media'),
        SUPABASE_BUCKET_AVATARS:           Joi.string().default('avatars'),
        SUPABASE_BUCKET_EVALUATIONS_PROOF: Joi.string().default('evaluations-proof'),
        FRONTEND_URL:                      Joi.string().required(),
        REDIS_URL:                         Joi.string().required(),
        PORT:                              Joi.number().default(3001),
        NODE_ENV:                          Joi.string().valid('development', 'production', 'test').default('development'),
      }),
    }),
    ScheduleModule.forRoot(),
    BadgeModule,
    EventLogModule,
    HealthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    // Seuil large pour la navigation normale — les routes sensibles overrident avec @Throttle
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    // Cache in-memory global — TTL 60s par défaut, overridable par cache.set(key, val, ttl)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        ttl: 60_000,
        stores: [
          new KeyvRedis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
        ],
      }),
    }),
    UserModule,
    AuthModule,
    WishModule,
    DonationModule,
    EvaluationModule,
    NotificationsModule,
    LeaderboardModule,
    FollowModule,
    FeedModule,
    CommentModule,
    ReactionModule,
  ],
  //Application throttleGuard sur toutes les routes
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    //Application JwtAuthGuard sur toutes les routes — les routes @Public() sont exemptées
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RolesGuard après JwtAuthGuard — req.user doit être peuplé avant le check de rôle
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
