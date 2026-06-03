import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './follow.entity';
import { User } from '../user/user.entity';

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
}
