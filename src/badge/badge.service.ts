import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Badge } from './badge.entity';
import { Evaluation } from '../donation/evaluation.entity';
import { BadgeType, BadgeDto } from './badge.types';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,
    private readonly notificationService: NotificationService,
  ) {}

  async award(userId: string, type: BadgeType, period?: string): Promise<void> {
    const existing = await this.badgeRepo.findOne({
      where: { user_id: userId, badge_type: type, period: period ?? IsNull() },
    });
    if (existing) {
      await this.badgeRepo.save({ ...existing, count: existing.count + 1 });
      return;
    }
    await this.badgeRepo.save(
      this.badgeRepo.create({ user_id: userId, badge_type: type, period: period ?? null, count: 1 }),
    );
    await this.notificationService.notify(userId, NotificationType.BADGE_EARNED, {
      badge_type: type,
    });
  }

  findByUser(userId: string): Promise<Badge[]> {
    return this.badgeRepo.find({
      where: { user_id: userId },
      order: { earned_at: 'DESC' },
    });
  }

  toDto(badge: Badge): BadgeDto {
    return { badge_type: badge.badge_type, period: badge.period, earned_at: badge.earned_at, count: badge.count };
  }

  // Exécuté le 1er du mois à minuit — attribue le badge du mois précédent
  @Cron('0 0 1 * *')
  async awardMonthlyBiggestDonor(): Promise<void> {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const period = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, '0')}`;

    const results: Array<{ donor_id: string; total_glow: string }> =
      await this.evaluationRepo
        .createQueryBuilder('e')
        .innerJoin('e.donation', 'd')
        .select('d.donor_id', 'donor_id')
        .addSelect('SUM(e.glow_awarded)', 'total_glow')
        .where('e.created_at >= :start', { start: prevMonthStart })
        .andWhere('e.created_at < :end', { end: currMonthStart })
        .groupBy('d.donor_id')
        .orderBy('total_glow', 'DESC')
        .getRawMany();

    if (!results.length) return;

    const maxGlow = parseInt(results[0]!.total_glow, 10);
    const winners = results.filter((r) => parseInt(r.total_glow, 10) === maxGlow);
    for (const winner of winners) {
      await this.award(winner.donor_id, BadgeType.BIGGEST_DONOR_MONTH, period);
    }
  }
}
