import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './notification-preference.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

const TRACKED_TYPES = ['donation_received', 'evaluation_received'] as const;

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
  ) {}

  async getPreferences(userId: string): Promise<{ event_type: string; email_enabled: boolean }[]> {
    const rows = await this.prefRepo.find({ where: { user_id: userId } });
    const map = new Map(rows.map(r => [r.event_type, r.email_enabled]));
    return TRACKED_TYPES.map(type => ({
      event_type: type,
      email_enabled: map.get(type) ?? true,
    }));
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto): Promise<void> {
    const entries = Object.entries(dto) as [string, boolean][];
    for (const [event_type, email_enabled] of entries) {
      if (email_enabled !== undefined) {
        await this.prefRepo.upsert(
          { user_id: userId, event_type, email_enabled },
          { conflictPaths: ['user_id', 'event_type'] },
        );
      }
    }
  }

  async isEmailEnabled(userId: string, eventType: string): Promise<boolean> {
    const pref = await this.prefRepo.findOne({ where: { user_id: userId, event_type: eventType } });
    return pref?.email_enabled ?? true;
  }
}
