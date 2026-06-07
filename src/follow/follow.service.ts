import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Follow } from './follow.entity';
import { User } from '../user/user.entity';
import { SuggestionDto } from './follow.types';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) {
      throw new BadRequestException('Impossible de se suivre soi-même');
    }
    const followedUser = await this.userRepo.findOne({ where: { id: followedId } });
    if (!followedUser) throw new NotFoundException('Utilisateur introuvable');

    const existing = await this.followRepo.findOne({
      where: { follower_id: followerId, followed_id: followedId },
    });
    if (existing) throw new ConflictException('Vous suivez déjà cet utilisateur');

    const follow = this.followRepo.create({ follower_id: followerId, followed_id: followedId });
    await this.followRepo.save(follow);

    const follower = await this.userRepo.findOne({ where: { id: followerId } });
    await this.notificationService.notify(followedId, NotificationType.NEW_FOLLOWER, {
      follower_pseudo: follower!.pseudo,
      follower_id: followerId,
    });
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    const follow = await this.followRepo.findOne({
      where: { follower_id: followerId, followed_id: followedId },
    });
    if (!follow) throw new NotFoundException('Relation de suivi introuvable');
    await this.followRepo.remove(follow);
  }

  countFollowers(userId: string): Promise<number> {
    return this.followRepo.count({ where: { followed_id: userId } });
  }

  countFollowing(userId: string): Promise<number> {
    return this.followRepo.count({ where: { follower_id: userId } });
  }

  async getFollowers(userId: string): Promise<SuggestionDto[]> {
    return this.dataSource.query<SuggestionDto[]>(
      `SELECT u.id, u.pseudo, u.avatar_url, u.grade, u.glow_points
       FROM users u
       INNER JOIN follows f ON f.follower_id = u.id
       WHERE f.followed_id = $1
       ORDER BY u.pseudo ASC`,
      [userId],
    );
  }

  async getFollowing(userId: string): Promise<SuggestionDto[]> {
    return this.dataSource.query<SuggestionDto[]>(
      `SELECT u.id, u.pseudo, u.avatar_url, u.grade, u.glow_points
       FROM users u
       INNER JOIN follows f ON f.followed_id = u.id
       WHERE f.follower_id = $1
       ORDER BY u.pseudo ASC`,
      [userId],
    );
  }

  async isFollowing(followerId: string, targetId: string): Promise<boolean> {
    const record = await this.followRepo.findOne({
      where: { follower_id: followerId, followed_id: targetId },
    });
    return !!record;
  }

  async getSuggestions(userId: string): Promise<SuggestionDto[]> {
    return this.dataSource.query<SuggestionDto[]>(
      `SELECT u.id, u.pseudo, u.avatar_url, u.grade, u.glow_points
       FROM users u
       WHERE u.id != $1
         AND u.id NOT IN (
           SELECT followed_id FROM follows WHERE follower_id = $1
         )
         AND u.glow_points > 0
       ORDER BY u.glow_points DESC
       LIMIT 10`,
      [userId],
    );
  }
}
