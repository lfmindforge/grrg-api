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

@Injectable()
export class WishService {
  constructor(
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async findPublic(query: QueryWishDto): Promise<PaginatedWishesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.wishRepo
      .createQueryBuilder('wish')
      .leftJoinAndSelect('wish.user', 'user')
      .where('wish.is_private = :isPrivate', { isPrivate: false });

    // Exclut les souhaits annulés par défaut sauf si status explicite
    if (query.status) {
      qb.andWhere('wish.status = :status', { status: query.status });
    } else {
      qb.andWhere('wish.status != :cancelled', {
        cancelled: WishStatus.CANCELLED,
      });
    }

    if (query.category) {
      qb.andWhere('LOWER(wish.category) = LOWER(:category)', {
        category: query.category,
      });
    }

    if (query.donation_type) {
      qb.andWhere('wish.donation_type = :donationType', {
        donationType: query.donation_type,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(wish.title ILIKE :search OR wish.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const sortOrder: 'ASC' | 'DESC' = query.order === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(this.resolveSortField(query.sort ?? 'date'), sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data: data as unknown as WishPublicDto[], total, page, limit };
  }

  async findOne(id: string): Promise<WishPublicDto> {
    const { entities, raw } = await this.wishRepo
      .createQueryBuilder('wish')
      .leftJoinAndSelect('wish.user', 'user')
      .addSelect(
        `(SELECT COALESCE(SUM(d.amount), 0) FROM donations d WHERE d.wish_id = wish.id AND d.status = 'completed')`,
        'donated_amount',
      )
      .where('wish.id = :id AND wish.is_private = :isPrivate', {
        id,
        isPrivate: false,
      })
      .getRawAndEntities();

    if (!entities[0]) {
      throw new NotFoundException('Souhait introuvable');
    }

    const donated_amount = parseFloat(raw[0]?.donated_amount ?? '0');
    return { ...entities[0], donated_amount } as unknown as WishPublicDto;
  }

  // Placeholder — remplacer 'popularity' par COUNT(donations) en US-007
  private resolveSortField(sort: string): string {
    switch (sort) {
      case 'amount':
        return 'wish.amount';
      case 'popularity':
        return 'wish.created_at';
      default:
        return 'wish.created_at';
    }
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
    qb.orderBy(this.resolveSortField(query.sort ?? 'date'), sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data: data as unknown as WishPublicDto[], total, page, limit };
  }

  async update(id: string, userId: string, dto: UpdateWishDto): Promise<Wish> {
    const wish = await this.findOwnedWishOrThrow(id, userId);
    Object.assign(wish, dto);
    return this.wishRepo.save(wish);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const wish = await this.findOwnedWishOrThrow(id, userId);
    if (wish.status === WishStatus.CANCELLED) return;
    wish.status = WishStatus.CANCELLED;
    await this.wishRepo.save(wish);
  }

  async findCategories(): Promise<string[]> {
    const rows = await this.wishRepo
      .createQueryBuilder('wish')
      .select('wish.category', 'category')
      .distinct(true)
      .where('wish.is_private = :isPrivate', { isPrivate: false })
      .orderBy('wish.category', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((r) => r.category);
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
      donation_type: dto.donation_type,
      amount: dto.amount ?? null,
      is_private: dto.is_private ?? false,
      media_urls: mediaUrls,
      status: WishStatus.PENDING,
    });

    return this.wishRepo.save(wish);
  }
}
