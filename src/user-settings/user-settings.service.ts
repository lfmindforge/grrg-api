import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { UserSetting } from './user-setting.entity';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSetting)
    private readonly repo: Repository<UserSetting>,
  ) {}

  async get(userId: string, key: string): Promise<unknown> {
    const row = await this.repo.findOne({ where: { user_id: userId, key } });
    return row?.value ?? null;
  }

  async set(userId: string, key: string, value: unknown): Promise<void> {
    await this.repo.upsert(
      { user_id: userId, key, value } as any,
      { conflictPaths: ['user_id', 'key'] },
    );
  }

  async getByPrefix(userId: string, prefix: string): Promise<Record<string, unknown>> {
    const rows = await this.repo.find({ where: { user_id: userId, key: Like(`${prefix}%`) } });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async isNotifEmailEnabled(userId: string, eventType: string): Promise<boolean> {
    const value = await this.get(userId, `notif.${eventType}`);
    return value !== false;
  }
}
