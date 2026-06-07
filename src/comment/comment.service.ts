import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { Wish } from '../wish/wish.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { CommentResponseDto, PaginatedCommentsDto } from './comment.types';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType, truncateTitle } from '../notifications/notification.types';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Wish)
    private readonly wishRepo: Repository<Wish>,
    private readonly notificationService: NotificationService,
  ) {}

  async getComments(wishId: string, dto: QueryCommentsDto): Promise<PaginatedCommentsDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    const wish = await this.wishRepo.findOne({ where: { id: wishId, is_private: false } });
    if (!wish) throw new NotFoundException('Souhait introuvable');

    const [comments, total] = await this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.wish_id = :wishId', { wishId })
      .orderBy('comment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: comments.map((c) => this.toDto(c)),
      total,
      page,
      limit,
    };
  }

  async addComment(
    userId: string,
    wishId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const wish = await this.wishRepo.findOne({ where: { id: wishId, is_private: false } });
    if (!wish) throw new NotFoundException('Souhait introuvable');

    const comment = this.commentRepo.create({ user_id: userId, wish_id: wishId, content: dto.content });
    const saved = await this.commentRepo.save(comment);

    // Recharge avec la relation user pour le DTO de retour
    const full = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    if (wish.user_id !== userId) {
      await this.notificationService.notify(wish.user_id, NotificationType.COMMENT_RECEIVED, {
        commenter_pseudo: full!.user.pseudo,
        wish_title: truncateTitle(wish.title),
        wish_id: wish.id,
        comment_id: full!.id,
      });
    }

    return this.toDto(full!);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    if (comment.user_id !== userId) throw new ForbiddenException('Accès refusé');
    await this.commentRepo.remove(comment);
  }

  async reportComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    comment.is_reported = true;
    await this.commentRepo.save(comment);
  }

  private toDto(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      wish_id: comment.wish_id,
      content: comment.content,
      is_reported: comment.is_reported,
      created_at: comment.created_at,
      author: {
        id: comment.user.id,
        pseudo: comment.user.pseudo,
        avatar_url: comment.user.avatar_url,
        grade: comment.user.grade,
      },
    };
  }
}
