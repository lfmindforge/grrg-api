import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BadgeModule,
    EventLogModule,
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
    //Config global, la route login ovveride @throttle (5/10min)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 100 }]),
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
