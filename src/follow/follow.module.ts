import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './follow.entity';
import { User } from '../user/user.entity';
import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, User]), NotificationsModule, EventLogModule],
  controllers: [FollowController],
  providers: [FollowService],
  exports: [FollowService],
})
export class FollowModule {}
