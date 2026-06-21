import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import { Donation } from '../donation/donation.entity';
import { Follow } from '../follow/follow.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StorageModule } from '../common/storage/storage.module';
import { FollowModule } from '../follow/follow.module';
import { BadgeModule } from '../badge/badge.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wish, Donation, Follow, RefreshToken]), StorageModule, FollowModule, BadgeModule, EventLogModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
