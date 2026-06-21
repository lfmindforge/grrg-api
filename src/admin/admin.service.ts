import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { Donation } from '../donation/donation.entity';
import { DonationStatus } from '../donation/donation.types';
import { BanUserDto } from './dto/ban-user.dto';
import { AdminStatsDto, ActivityDayDto, CountByKeyDto } from './dto/admin-stats.dto';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';
import { MailService } from '../mail/mail.service';
import { buildBanTemplate, buildUnbanTemplate } from '../mail/mail.templates';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)     private readonly userRepo:     Repository<User>,
    @InjectRepository(Wish)     private readonly wishRepo:     Repository<Wish>,
    @InjectRepository(Comment)  private readonly commentRepo:  Repository<Comment>,
    @InjectRepository(Donation) private readonly donationRepo: Repository<Donation>,
    private readonly eventService: EventLogService,
    private readonly mailService:  MailService,
  ) {}

  async searchUsers(q: string): Promise<Partial<User>[]> {
    return this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.pseudo', 'u.email', 'u.grade', 'u.banned_until', 'u.role'])
      .where('u.pseudo ILIKE :q', { q: `%${q}%` })
      .orderBy('u.pseudo', 'ASC')
      .limit(20)
      .getMany();
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const bannedUntil = new Date(dto.until);
    await this.userRepo.update(userId, { banned_until: bannedUntil });

    await this.eventService.log(EventType.ADMIN_BAN, adminId, {
      target_user_id: userId,
      target_pseudo: user.pseudo,
      until: dto.until,
      reason: dto.reason,
    });

    const template = buildBanTemplate({ pseudo: user.pseudo, reason: dto.reason, bannedUntil });
    await this.mailService.sendMail(user.email, template.subject, template.html);
  }

  async unbanUser(adminId: string, userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.userRepo.update(userId, { banned_until: null });

    await this.eventService.log(EventType.ADMIN_UNBAN, adminId, {
      target_user_id: userId,
      target_pseudo: user.pseudo,
    });

    const template = buildUnbanTemplate({ pseudo: user.pseudo });
    await this.mailService.sendMail(user.email, template.subject, template.html);
  }

  async deleteContent(adminId: string, type: 'wish' | 'comment', id: string): Promise<void> {
    if (type === 'wish') {
      const wish = await this.wishRepo.findOne({ where: { id } });
      if (!wish) throw new NotFoundException('Souhait introuvable');
      await this.wishRepo.softRemove(wish);
    } else {
      const comment = await this.commentRepo.findOne({ where: { id } });
      if (!comment) throw new NotFoundException('Commentaire introuvable');
      await this.commentRepo.softRemove(comment);
    }

    await this.eventService.log(EventType.ADMIN_CONTENT_DELETE, adminId, {
      target_type: type,
      target_id: id,
    });
  }

  async getStats(): Promise<AdminStatsDto> {
    const [
      total_users,
      total_wishes,
      total_donations,
      total_donations_completed,
      donationsByType,
      wishesByStatus,
      topCategories,
      activityUsers,
      activityWishes,
      activityDonations,
    ] = await Promise.all([
      this.userRepo.count({ where: { deleted_at: IsNull() } }),
      this.wishRepo.count({ where: { deleted_at: IsNull() } }),
      this.donationRepo.count(),
      this.donationRepo.count({ where: { status: DonationStatus.COMPLETED } }),
      this.donationRepo
        .createQueryBuilder('d')
        .select('d.type', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.type')
        .getRawMany<CountByKeyDto>(),
      this.wishRepo
        .createQueryBuilder('w')
        .select('w.status', 'key')
        .addSelect('COUNT(*)', 'count')
        .where('w.deleted_at IS NULL')
        .groupBy('w.status')
        .getRawMany<CountByKeyDto>(),
      this.wishRepo
        .createQueryBuilder('w')
        .select('w.category', 'key')
        .addSelect('COUNT(*)', 'count')
        .where('w.deleted_at IS NULL')
        .groupBy('w.category')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany<CountByKeyDto>(),
      this.userRepo
        .createQueryBuilder('u')
        .select("TO_CHAR(DATE_TRUNC('day', u.created_at), 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .where("u.created_at >= NOW() - INTERVAL '30 days'")
        .groupBy("DATE_TRUNC('day', u.created_at)")
        .getRawMany<{ date: string; count: string }>(),
      this.wishRepo
        .createQueryBuilder('w')
        .select("TO_CHAR(DATE_TRUNC('day', w.created_at), 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .where("w.created_at >= NOW() - INTERVAL '30 days'")
        .andWhere('w.deleted_at IS NULL')
        .groupBy("DATE_TRUNC('day', w.created_at)")
        .getRawMany<{ date: string; count: string }>(),
      this.donationRepo
        .createQueryBuilder('d')
        .select("TO_CHAR(DATE_TRUNC('day', d.created_at), 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .where("d.created_at >= NOW() - INTERVAL '30 days'")
        .groupBy("DATE_TRUNC('day', d.created_at)")
        .getRawMany<{ date: string; count: string }>(),
    ]);

    return {
      kpis: { total_users, total_wishes, total_donations, total_donations_completed },
      donations_by_type: donationsByType.map((r) => ({ key: r.key, count: Number(r.count) })),
      wishes_by_status:  wishesByStatus.map((r)  => ({ key: r.key, count: Number(r.count) })),
      top_categories:    topCategories.map((r)   => ({ key: r.key, count: Number(r.count) })),
      activity: this.mergeActivity(activityUsers, activityWishes, activityDonations),
    };
  }

  private mergeActivity(
    users:     { date: string; count: string }[],
    wishes:    { date: string; count: string }[],
    donations: { date: string; count: string }[],
  ): ActivityDayDto[] {
    const map = new Map<string, ActivityDayDto>();

    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, users: 0, wishes: 0, donations: 0 });
    }

    for (const r of users)     { const e = map.get(r.date); if (e) e.users     = Number(r.count); }
    for (const r of wishes)    { const e = map.get(r.date); if (e) e.wishes    = Number(r.count); }
    for (const r of donations) { const e = map.get(r.date); if (e) e.donations = Number(r.count); }

    return [...map.values()];
  }
}
