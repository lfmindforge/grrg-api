import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './badge.entity';
import { Evaluation } from '../donation/evaluation.entity';
import { BadgeService } from './badge.service';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, Evaluation])],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
