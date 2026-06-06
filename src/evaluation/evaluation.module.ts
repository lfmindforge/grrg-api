import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from '../donation/evaluation.entity';
import { Donation } from '../donation/donation.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { StorageModule } from '../common/storage/storage.module';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { GlowService } from '../common/glow.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { BadgeModule } from '../badge/badge.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evaluation, Donation, Wish, User]),
    StorageModule,
    NotificationsModule,
    BadgeModule,
  ],
  controllers: [EvaluationController],
  providers: [EvaluationService, GlowService],
})
export class EvaluationModule {}
