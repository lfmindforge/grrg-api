import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from './event-log.entity';
import { EventType } from './event-log.types';
import { User } from '../user/user.entity';

@Injectable()
export class EventLogService {
  constructor(
    @InjectRepository(EventLog)
    private readonly eventRepo: Repository<EventLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async log(
    type: EventType,
    actorId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    let triggered_by: { id: string; pseudo: string } | null = null;

    if (actorId) {
      const user = await this.userRepo.findOne({
        where: { id: actorId },
        select: ['id', 'pseudo'],
      });
      triggered_by = user ? { id: user.id, pseudo: user.pseudo } : null;
    }

    await this.eventRepo.save(
      this.eventRepo.create({
        type,
        actor_id: actorId,
        payload: { triggered_by, ...metadata },
      }),
    );
  }
}
