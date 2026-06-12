import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { BanUserDto } from './dto/ban-user.dto';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';
import { MailService } from '../mail/mail.service';
import { buildBanTemplate, buildUnbanTemplate } from '../mail/mail.templates';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)    private readonly userRepo:    Repository<User>,
    @InjectRepository(Wish)    private readonly wishRepo:    Repository<Wish>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
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
}
