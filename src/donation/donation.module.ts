import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './donation.entity';
import { Evaluation } from './evaluation.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';
import { BadgeModule } from '../badge/badge.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, Evaluation, Wish, User]), BadgeModule, NotificationsModule],
  controllers: [DonationController],
  providers: [DonationService],
})
export class DonationModule {}
