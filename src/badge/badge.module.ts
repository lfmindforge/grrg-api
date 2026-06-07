import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './badge.entity';
import { Evaluation } from '../donation/evaluation.entity';
import { BadgeService } from './badge.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, Evaluation]), NotificationsModule],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
