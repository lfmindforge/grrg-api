import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { WishModule } from './wish/wish.module';
import { DonationModule } from './donation/donation.module';
import { EvaluationModule } from './evaluation/evaluation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: false,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    //Config global, la route login ovveride @throttle (5/10min)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 100 }]),
    UserModule,
    AuthModule,
    WishModule,
    DonationModule,
    EvaluationModule,
  ],
  //Application throttleGuard sur toutes les routes
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    //Application JwtAuthGuard sur toutes les routes — les routes @Public() sont exemptées
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
