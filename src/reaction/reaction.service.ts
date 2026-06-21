import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { UpsertReactionDto } from './dto/upsert-reaction.dto';
import { MyReactionDto } from './reaction.types';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType, truncateTitle } from '../notifications/notification.types';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reaction) private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly eventService: EventLogService,
  ) {}

  async upsert(userId: string, wishId: string, dto: UpsertReactionDto): Promise<void> {
    const wish = await this.wishRepo.findOne({ where: { id: wishId, is_private: false } });
    if (!wish) throw new NotFoundException('Souhait introuvable');

    const existing = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    if (existing) {
      existing.emoji = dto.emoji;
      await this.reactionRepo.save(existing);
      await this.eventService.log(EventType.REACTION_UPSERT, userId, { wish_id: wishId, emoji: dto.emoji, action: 'update' });
    } else {
      const reaction = this.reactionRepo.create({ user_id: userId, wish_id: wishId, emoji: dto.emoji });
      await this.reactionRepo.save(reaction);
      await this.eventService.log(EventType.REACTION_UPSERT, userId, { wish_id: wishId, emoji: dto.emoji, action: 'create' });
      if (wish.user_id !== userId) {
        const reactor = await this.userRepo.findOne({ where: { id: userId } });
        await this.notificationService.notify(wish.user_id, NotificationType.REACTION_RECEIVED, {
          reactor_pseudo: reactor!.pseudo,
          emoji: dto.emoji,
          wish_title: truncateTitle(wish.title),
          wish_id: wishId,
        });
      }
    }
  }

  async delete(userId: string, wishId: string): Promise<void> {
    const reaction = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    if (!reaction) throw new NotFoundException('Réaction introuvable');
    await this.eventService.log(EventType.REACTION_DELETE, userId, { wish_id: wishId });
    await this.reactionRepo.remove(reaction);
  }

  async getMyReaction(userId: string, wishId: string): Promise<MyReactionDto> {
    const reaction = await this.reactionRepo.findOne({ where: { user_id: userId, wish_id: wishId } });
    return { emoji: reaction?.emoji ?? null };
  }
}
