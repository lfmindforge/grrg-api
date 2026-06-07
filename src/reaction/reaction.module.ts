import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction, Wish, User]), NotificationsModule],
  controllers: [ReactionController],
  providers: [ReactionService],
  exports: [TypeOrmModule],
})
export class ReactionModule {}
