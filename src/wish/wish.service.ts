import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Wish } from './wish.entity';
import { CreateWishDto } from './dto/create-wish.dto';
import { SupabaseStorageService } from './supabase-storage.service';
import { WishStatus } from './wish.types';

@Injectable()
export class WishService {
  constructor(
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  findPublic(): Promise<Wish[]> {
    return this.wishRepo.find({ where: { is_private: false } });
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
