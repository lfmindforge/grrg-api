import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Wish } from './wish.entity';
import { CreateWishDto } from './dto/create-wish.dto';
import { QueryWishDto } from './dto/query-wish.dto';
import { PaginatedWishesDto, WishPublicDto } from './dto/wish-response.dto';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { WishStatus } from './wish.types';
import { UpdateWishDto } from './dto/update-wish.dto';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

@Injectable()
export class WishService {
  constructor(
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
    private readonly eventService: EventLogService,
  ) {}

  async findPublic(query: QueryWishDto): Promise<PaginatedWishesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.wishRepo
      .createQueryBuilder('wish')
      .leftJoinAndSelect('wish.user', 'user')
      .where('wish.is_private = :isPrivate', { isPrivate: false });

    // Exclut les souhaits annulés et expirés par défaut sauf si status explicite
    if (query.status) {
      qb.andWhere('wish.status = :status', { status: query.status });
    } else {
      qb.andWhere('wish.status != :cancelled', { cancelled: WishStatus.CANCELLED });
      qb.andWhere('wish.status != :expired', { expired: WishStatus.EXPIRED });
    }
    // Double sécurité entre deux passages du cron
    qb.andWhere('(wish.expires_at IS NULL OR wish.expires_at > :now)', { now: new Date() });

    if (query.category) {
      qb.andWhere('LOWER(wish.category) = LOWER(:category)', {
        category: query.category,
      });
    }

    if (query.search) {
      const words = query.search.trim().split(/\s+/).filter(Boolean);
      words.forEach((word, i) => {
        qb.andWhere(
          `(wish.title ILIKE :w${i} OR wish.description ILIKE :w${i})`,
          { [`w${i}`]: `%${word}%` },
        );
      });
    }

    const sortOrder: 'ASC' | 'DESC' = query.order === 'asc' ? 'ASC' : 'DESC';

    // Tri primaire : pending → in_progress → fulfilled
    qb.addSelect(
      `CASE wish.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'fulfilled' THEN 3 ELSE 4 END`,
      'status_order',
    ).orderBy('status_order', 'ASC');

    if ((query.sort ?? 'date') === 'popularity') {
      qb.addSelect(
        '(SELECT COUNT(r.id) FROM reactions r WHERE r.wish_id = wish.id)',
        'reactions_count',
      ).addOrderBy('reactions_count', sortOrder);
    } else {
      qb.addOrderBy(this.resolveSortField(query.sort ?? 'date'), sortOrder);
    }

    qb.addSelect(
      '(SELECT COUNT(c.id)::int FROM comments c WHERE c.wish_id = wish.id)',
      'comments_count',
    );
    qb.addSelect(
      `(SELECT COALESCE(
          json_agg(json_build_object('emoji', emoji, 'count', cnt) ORDER BY cnt DESC),
          '[]'::json
        )
        FROM (
          SELECT emoji, COUNT(*)::int AS cnt
          FROM reactions
          WHERE wish_id = wish.id
          GROUP BY emoji
        ) _r)`,
      'reactions',
    );

    // getCount() exécute un SELECT COUNT(*) indépendant (ignore skip/take et addSelect)
    const total = await qb.getCount();
    qb.skip((page - 1) * limit).take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const data = entities.map((entity, i) => ({
      ...entity,
      comments_count: parseInt(raw[i]?.comments_count ?? '0', 10),
      reactions: raw[i]?.reactions ?? [],
    }));

    return { data: data as unknown as WishPublicDto[], total, page, limit };
  }

  async findOne(id: string, viewerId: string | null = null): Promise<WishPublicDto> {
    const { entities, raw } = await this.wishRepo
      .createQueryBuilder('wish')
      .leftJoinAndSelect('wish.user', 'user')
      .addSelect(
        `(SELECT COALESCE(SUM(d.amount), 0) FROM donations d WHERE d.wish_id = wish.id AND d.status = 'completed')`,
        'donated_amount',
      )
      .addSelect(
        '(SELECT COUNT(c.id)::int FROM comments c WHERE c.wish_id = wish.id)',
        'comments_count',
      )
      .addSelect(
        `(SELECT COALESCE(
            json_agg(json_build_object('emoji', emoji, 'count', cnt) ORDER BY cnt DESC),
            '[]'::json
          )
          FROM (
            SELECT emoji, COUNT(*)::int AS cnt
            FROM reactions
            WHERE wish_id = wish.id
            GROUP BY emoji
          ) _r)`,
        'reactions',
      )
      .where('wish.id = :id', { id })
      .andWhere('wish.status != :expired', { expired: WishStatus.EXPIRED })
      .andWhere('(wish.expires_at IS NULL OR wish.expires_at > :now)', { now: new Date() })
      .getRawAndEntities();

    const wish = entities[0];
    if (!wish) throw new NotFoundException('Souhait introuvable');

    if (wish.is_private) {
      const isOwner = viewerId === wish.user_id;
      const isFollower = viewerId
        ? (await this.wishRepo.manager.query<{ exists: boolean }[]>(
            `SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2) AS exists`,
            [viewerId, wish.user_id],
          ))[0]?.exists ?? false
        : false;
      if (!isOwner && !isFollower) throw new NotFoundException('Souhait introuvable');
    }

    const donated_amount = parseFloat(raw[0]?.donated_amount ?? '0');
    const comments_count = parseInt(raw[0]?.comments_count ?? '0', 10);
    const reactions = raw[0]?.reactions ?? [];
    return { ...entities[0], donated_amount, comments_count, reactions } as unknown as WishPublicDto;
  }

  private resolveSortField(sort: string): string {
    return 'wish.created_at';
  }

  async findMine(
    userId: string,
    query: QueryWishDto,
  ): Promise<PaginatedWishesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.wishRepo
      .createQueryBuilder('wish')
      .where('wish.user_id = :userId', { userId });

    if (query.status) {
      qb.andWhere('wish.status = :status', { status: query.status });
    }

    const sortOrder: 'ASC' | 'DESC' = query.order === 'asc' ? 'ASC' : 'DESC';

    // Tri primaire : pending → in_progress → fulfilled
    qb.addSelect(
      `CASE wish.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'fulfilled' THEN 3 ELSE 4 END`,
      'status_order',
    ).orderBy('status_order', 'ASC')
      .addOrderBy(this.resolveSortField(query.sort ?? 'date'), sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data: data as unknown as WishPublicDto[], total, page, limit };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateWishDto,
    file?: Express.Multer.File,
  ): Promise<Wish> {
    const wish = await this.findOwnedWishOrThrow(id, userId);
    Object.assign(wish, dto);

    const updatedFields = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);

    if (file && wish.status === WishStatus.PENDING) {
      const bucket = this.config.getOrThrow<string>('SUPABASE_BUCKET_WISHES');
      if (wish.media_urls?.length) {
        const paths = wish.media_urls
          .map((url) => this.supabaseStorage.extractPath(bucket, url))
          .filter((p): p is string => p !== null);
        if (paths.length) await this.supabaseStorage.delete(bucket, paths);
      }
      const ext = file.originalname.split('.').pop() ?? 'bin';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await this.supabaseStorage.upload(bucket, path, file);
      wish.media_urls = [url];
      updatedFields.push('media_urls');
    }

    if (dto.expires_at !== undefined) {
      wish.expires_at = dto.expires_at ? new Date(dto.expires_at) : null;
    }

    const saved = await this.wishRepo.save(wish);
    await this.eventService.log(EventType.WISH_UPDATE, userId, { wish_id: id, updated_fields: updatedFields });
    return saved;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const wish = await this.findOwnedWishOrThrow(id, userId);
    if (wish.status === WishStatus.CANCELLED) return;
    if (wish.media_urls?.length) {
      const bucket = this.config.getOrThrow<string>('SUPABASE_BUCKET_WISHES');
      const paths = wish.media_urls
        .map((url) => this.supabaseStorage.extractPath(bucket, url))
        .filter((p): p is string => p !== null);
      if (paths.length) await this.supabaseStorage.delete(bucket, paths);
    }
    await this.eventService.log(EventType.WISH_DELETE, userId, { wish_id: id, title: wish.title });
    wish.status = WishStatus.CANCELLED;
    await this.wishRepo.softRemove(wish);
  }

  async findCategories(): Promise<string[]> {
    const rows = await this.wishRepo.manager.query<{ name: string }[]>(
      `SELECT name FROM categories ORDER BY name ASC`,
    );
    return rows.map((r) => r.name);
  }

  private async findOwnedWishOrThrow(
    id: string,
    userId: string,
  ): Promise<Wish> {
    const wish = await this.wishRepo.findOne({ where: { id } });
    if (!wish) throw new NotFoundException('Souhait introuvable');
    if (wish.user_id !== userId) throw new ForbiddenException('Accès refusé');
    return wish;
  }

  async create(
    userId: string,
    dto: CreateWishDto,
    files: Express.Multer.File[],
  ): Promise<Wish> {
    const bucket = this.config.getOrThrow<string>('SUPABASE_BUCKET_WISHES');
    const mediaUrls: string[] = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop() ?? 'bin';
      // Chemin unique par user pour éviter les collisions
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await this.supabaseStorage.upload(bucket, path, file);
      mediaUrls.push(url);
    }

    const wish = this.wishRepo.create({
      user_id: userId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      is_private: dto.is_private ?? false,
      media_urls: mediaUrls,
      status: WishStatus.PENDING,
      expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
    });

    const saved = await this.wishRepo.save(wish);
    await this.eventService.log(EventType.WISH_CREATE, userId, { title: saved.title, category: saved.category, is_private: saved.is_private });
    return saved;
  }
}
