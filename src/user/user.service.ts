import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import {
  CreateUserData,
  UserPublicProfileDto,
  WishPreviewDto,
} from './user.types';
import { WishStatus } from '../wish/wish.types';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findByPseudo(pseudo: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { pseudo } });
  }

  findByOAuthId(provider: string, oauthId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { oauth_provider: provider, oauth_id: oauthId },
    });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async getProfile(id: string): Promise<UserPublicProfileDto> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const wishes = await this.wishRepo.find({
      where: {
        user_id: id,
        is_private: false,
        status: Not(WishStatus.CANCELLED),
      },
      order: { created_at: 'DESC' },
    });

    const gallery: WishPreviewDto[] = wishes.map((w) => ({
      id: w.id,
      title: w.title,
      cover: w.media_urls[0] ?? null,
      status: w.status,
    }));

    return {
      id: user.id,
      pseudo: user.pseudo,
      avatar_url: user.avatar_url,
      grade: user.grade,
      glow_points: user.glow_points,
      badges: [],
      donations_count: 0,
      gallery,
    };
  }

  async updateMe(
    userId: string,
    dto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<UserPublicProfileDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    // userId vient du JWT — l'utilisateur existe toujours

    if (dto.pseudo && dto.pseudo !== user!.pseudo) {
      const existing = await this.findByPseudo(dto.pseudo);
      if (existing) throw new ConflictException('Pseudo déjà utilisé');
      user!.pseudo = dto.pseudo;
    }

    if (file) {
      const bucket = this.config.getOrThrow<string>('SUPABASE_BUCKET_AVATARS');
      const ext = file.originalname.split('.').pop() ?? 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      user!.avatar_url = await this.supabaseStorage.upload(bucket, path, file);
    }

    await this.userRepo.save(user!);
    return this.getProfile(userId);
  }
}
