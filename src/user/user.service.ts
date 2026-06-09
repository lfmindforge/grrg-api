import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import { Donation } from '../donation/donation.entity';
import { Follow } from '../follow/follow.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import {
  CreateUserData,
  UserPublicProfileDto,
  WishPreviewDto,
} from './user.types';
import { WishStatus } from '../wish/wish.types';
import { DonationStatus } from '../donation/donation.types';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserExportDto } from './dto/user-export.dto';
import { BadgeService } from '../badge/badge.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Wish) private readonly wishRepo: Repository<Wish>,
    @InjectRepository(Donation) private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Follow) private readonly followRepo: Repository<Follow>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
    private readonly badgeService: BadgeService,
    private readonly eventService: EventLogService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

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

    const [wishes, donations_count, followers_count, following_count, badgeEntities] =
      await Promise.all([
        this.wishRepo.find({
          where: { user_id: id, is_private: false, status: Not(WishStatus.CANCELLED) },
          order: { created_at: 'DESC' },
        }),
        this.donationRepo.count({ where: { donor_id: id, status: DonationStatus.COMPLETED } }),
        this.followRepo.count({ where: { followed_id: id } }),
        this.followRepo.count({ where: { follower_id: id } }),
        this.badgeService.findByUser(id),
      ]);

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
      badges: badgeEntities.map((b) => this.badgeService.toDto(b)),
      donations_count,
      followers_count,
      following_count,
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
      if (user!.avatar_url) {
        const oldPath = this.supabaseStorage.extractPath(bucket, user!.avatar_url);
        if (oldPath) await this.supabaseStorage.delete(bucket, [oldPath]);
      }
      const ext = file.originalname.split('.').pop() ?? 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      user!.avatar_url = await this.supabaseStorage.upload(bucket, path, file);
    }

    const updatedFields = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    if (file) updatedFields.push('avatar_url');
    await this.userRepo.save(user!);
    await this.eventService.log(EventType.USER_UPDATE, userId, { updated_fields: updatedFields });
    return this.getProfile(userId);
  }

  async deleteMe(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    // log AVANT anonymisation pour conserver le vrai pseudo dans l'historique
    await this.eventService.log(EventType.USER_DELETE, userId, { pseudo: user!.pseudo });

    if (user!.avatar_url) {
      const bucket = this.config.getOrThrow<string>('SUPABASE_BUCKET_AVATARS');
      const path = this.supabaseStorage.extractPath(bucket, user!.avatar_url);
      if (path) await this.supabaseStorage.delete(bucket, [path]);
    }

    user!.email = `deleted_${randomUUID()}@anon.grrg`;
    user!.pseudo = 'utilisateur_supprimé';
    user!.avatar_url = null;
    user!.password_hash = null;
    user!.oauth_id = null;

    await this.refreshTokenRepo.delete({ user_id: userId });

    // softRemove pose deleted_at et sauvegarde l'anonymisation en une seule opération
    await this.userRepo.softRemove(user!);
  }

  async exportMe(userId: string): Promise<UserExportDto> {
    const [user, wishes, donationsMade, donationsReceived] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.wishRepo.find({ where: { user_id: userId }, withDeleted: true }),
      this.donationRepo.find({ where: { donor_id: userId }, withDeleted: true }),
      this.donationRepo
        .createQueryBuilder('d')
        .innerJoin('wishes', 'w', 'w.id = d.wish_id')
        .where('w.user_id = :userId', { userId })
        .withDeleted()
        .getMany(),
    ]);

    await this.eventService.log(EventType.USER_EXPORT, userId, {});

    return {
      profile: {
        id: user!.id,
        email: user!.email,
        pseudo: user!.pseudo,
        birthdate: user!.birthdate,
        grade: user!.grade,
        glow_points: user!.glow_points,
        created_at: user!.created_at,
      },
      wishes,
      donations_made: donationsMade,
      donations_received: donationsReceived,
    };
  }
}
