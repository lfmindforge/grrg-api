import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wish } from './wish.entity';
import { WishStatus } from './wish.types';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class WishSchedulerService {
  constructor(
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    private readonly notificationService: NotificationService,
  ) {}

  // Tourne tous les jours à minuit UTC
  @Cron('0 0 * * *')
  async expireWishes(): Promise<void> {
    const wishes = await this.wishRepo
      .createQueryBuilder('wish')
      .where('wish.expires_at < NOW()')
      .andWhere('wish.status IN (:...statuses)', {
        statuses: [WishStatus.PENDING, WishStatus.IN_PROGRESS],
      })
      .getMany();

    for (const wish of wishes) {
      wish.status = WishStatus.EXPIRED;
      await this.wishRepo.save(wish);
      await this.notificationService.notify(
        wish.user_id,
        NotificationType.WISH_EXPIRED,
        { wish_title: wish.title, wish_id: wish.id },
      );
    }
  }
}
