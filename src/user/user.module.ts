import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wish]), StorageModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
