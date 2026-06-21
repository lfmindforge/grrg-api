import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction, Wish, User]), NotificationsModule, EventLogModule],
  controllers: [ReactionController],
  providers: [ReactionService],
  exports: [TypeOrmModule],
})
export class ReactionModule {}
