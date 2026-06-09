import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from './event-log.entity';
import { EventType } from './event-log.types';
import { User } from '../user/user.entity';
import { QueryEventLogDto } from './dto/query-event-log.dto';

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

  async findAll(query: QueryEventLogDto): Promise<{ data: EventLog[]; total: number; page: number; limit: number }> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.eventRepo
      .createQueryBuilder('el')
      .orderBy('el.created_at', 'DESC');

    if (query.type)     qb.andWhere('el.type     = :type',     { type:     query.type });
    if (query.actor_id) qb.andWhere('el.actor_id = :actor_id', { actor_id: query.actor_id });
    if (query.from)     qb.andWhere('el.created_at >= :from',  { from:     new Date(query.from) });
    if (query.to)       qb.andWhere('el.created_at <= :to',    { to:       new Date(query.to) });

    const total = await qb.getCount();
    const data  = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { data, total, page, limit };
  }
}
