import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';
import { Wish } from '../wish/wish.entity';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Wish]), NotificationsModule, EventLogModule],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
