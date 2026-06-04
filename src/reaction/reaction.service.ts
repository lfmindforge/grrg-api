import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { UpsertReactionDto } from './dto/upsert-reaction.dto';
import { MyReactionDto } from './reaction.types';

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reaction) private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
  ) {}

  async upsert(userId: string, wishId: string, dto: UpsertReactionDto): Promise<void> {
    const wish = await this.wishRepo.findOne({ where: { id: wishId, is_private: false } });
    if (!wish) throw new NotFoundException('Souhait introuvable');

    const existing = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    if (existing) {
      existing.emoji = dto.emoji;
      await this.reactionRepo.save(existing);
    } else {
      const reaction = this.reactionRepo.create({ user_id: userId, wish_id: wishId, emoji: dto.emoji });
      await this.reactionRepo.save(reaction);
    }
  }

  async delete(userId: string, wishId: string): Promise<void> {
    const reaction = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    if (!reaction) throw new NotFoundException('Réaction introuvable');
    await this.reactionRepo.remove(reaction);
  }

  async getMyReaction(userId: string, wishId: string): Promise<MyReactionDto> {
    const reaction = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    return { emoji: reaction?.emoji ?? null };
  }
}
