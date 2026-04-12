import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async create(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<Notification> {
    return this.notificationRepo.save(
      this.notificationRepo.create({ user_id: userId, type, payload }),
    );
  }
}
