import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    // Les secrets sont passés dynamiquement via ConfigService dans signAsyn/verify
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
    ConfigModule,
    EventLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GitHubStrategy],
})
export class AuthModule {}
