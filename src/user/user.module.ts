import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import { Donation } from '../donation/donation.entity';
import { Follow } from '../follow/follow.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wish, Donation, Follow]), StorageModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
