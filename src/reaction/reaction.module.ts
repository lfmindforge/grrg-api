import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction, Wish])],
  controllers: [ReactionController],
  providers: [ReactionService],
  exports: [TypeOrmModule],
})
export class ReactionModule {}
