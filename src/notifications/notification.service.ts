import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import { Notification } from './notification.entity';
import { NotificationType } from './notification.types';
import { User } from '../user/user.entity';
import { MailService } from '../mail/mail.service';
import { buildEmailTemplate } from '../mail/mail.templates';
import { UserSettingsService } from '../user-settings/user-settings.service';

@Injectable()
export class NotificationService {
  private readonly clients = new Map<string, Subject<MessageEvent>[]>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  async create(userId: string, type: string, payload: Record<string, unknown>): Promise<Notification> {
    return this.notificationRepo.save(
      this.notificationRepo.create({ user_id: userId, type, payload }),
    );
  }

  async notify(userId: string, type: NotificationType, payload: Record<string, unknown>): Promise<void> {
    const notification = await this.create(userId, type as string, payload);
    this.pushToClient(userId, notification);

    const template = buildEmailTemplate(type, payload);
    if (template) {
      const canEmail = await this.userSettingsService.isNotifEmailEnabled(userId, type as string);
      if (canEmail) {
        const user = await this.userRepo.findOne({ where: { id: userId }, select: ['email'] });
        if (user?.email) {
          try {
            await this.mailService.sendMail(user.email, template.subject, template.html);
          } catch {
            // L'email est non-bloquant — la notification SSE est déjà envoyée
          }
        }
      }
    }
  }

  async findByUser(userId: string): Promise<{ data: Notification[]; unread_count: number }> {
    const data = await this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 30,
    });
    return { data, unread_count: data.filter((n) => !n.is_read).length };
  }

  async markRead(userId: string, notifId: string): Promise<void> {
    await this.notificationRepo.update({ id: notifId, user_id: userId }, { is_read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ user_id: userId, is_read: false }, { is_read: true });
  }

  registerClient(userId: string): Subject<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    const existing = this.clients.get(userId) ?? [];
    this.clients.set(userId, [...existing, subject]);
    return subject;
  }

  removeClient(userId: string, subject: Subject<MessageEvent>): void {
    const remaining = (this.clients.get(userId) ?? []).filter((s) => s !== subject);
    if (remaining.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, remaining);
    }
    subject.complete();
  }

  pushToClient(userId: string, notification: Notification): void {
    (this.clients.get(userId) ?? []).forEach((s) =>
      s.next({ data: notification } as MessageEvent),
    );
  }
}
