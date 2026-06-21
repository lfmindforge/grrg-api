import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './badge.entity';
import { Evaluation } from '../donation/evaluation.entity';
import { BadgeService } from './badge.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, Evaluation]), NotificationsModule, EventLogModule],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
