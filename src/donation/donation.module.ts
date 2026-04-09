import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './donation.entity';
import { Evaluation } from './evaluation.entity';
import { Wish } from '../wish/wish.entity';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, Evaluation, Wish])],
  controllers: [DonationController],
  providers: [DonationService],
})
export class DonationModule {}
