import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Report, ReportTargetType } from './report.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { User } from '../user/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { PaginatedReportsDto, ReportResponseDto } from './report.types';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Wish)
    private readonly wishRepo: Repository<Wish>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly eventService: EventLogService,
  ) {}

  async createReport(reporterId: string, dto: CreateReportDto): Promise<ReportResponseDto> {
    const ownerId = await this.getTargetOwnerId(dto.target_type, dto.target_id);

    if (ownerId === reporterId) {
      throw new ForbiddenException('Impossible de signaler son propre contenu');
    }

    const existing = await this.reportRepo.findOne({
      where: { reporter_id: reporterId, target_type: dto.target_type, target_id: dto.target_id },
    });
    if (existing) {
      throw new ConflictException('Ce contenu a déjà été signalé par cet utilisateur');
    }

    const report = this.reportRepo.create({
      reporter_id: reporterId,
      target_type: dto.target_type,
      target_id: dto.target_id,
      reason: dto.reason,
      details: dto.details ?? null,
    });

    const saved = await this.reportRepo.save(report);

    await this.eventService.log(
      EventType.REPORT_CREATE,
      reporterId,
      { target_type: dto.target_type, target_id: dto.target_id, reason: dto.reason },
    );

    return this.toDto(saved, null);
  }

  async getReports(dto: QueryReportsDto): Promise<PaginatedReportsDto> {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.reportRepo
      .createQueryBuilder('report')
      .orderBy('report.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (dto.target_type) {
      qb.where('report.target_type = :type', { type: dto.target_type });
    }

    const [reports, total] = await qb.getManyAndCount();

    // Résolution des auteurs en batch pour éviter le N+1
    const wishIds    = reports.filter(r => r.target_type === ReportTargetType.WISH).map(r => r.target_id);
    const commentIds = reports.filter(r => r.target_type === ReportTargetType.COMMENT).map(r => r.target_id);

    const wishes   = wishIds.length    ? await this.wishRepo.find({ where: { id: In(wishIds) } })    : [];
    const comments = commentIds.length ? await this.commentRepo.find({ where: { id: In(commentIds) } }) : [];

    const ownerIds = [...new Set([...wishes.map(w => w.user_id), ...comments.map(c => c.user_id)])];
    const owners   = ownerIds.length
      ? await this.userRepo.find({ where: { id: In(ownerIds) }, select: ['id', 'pseudo'] })
      : [];

    const ownerMap  = new Map(owners.map(u => [u.id, u]));
    const wishMap   = new Map(wishes.map(w => [w.id, w]));
    const commentMap = new Map(comments.map(c => [c.id, c]));

    const data = reports.map(r => {
      const ownerId = r.target_type === ReportTargetType.WISH
        ? wishMap.get(r.target_id)?.user_id
        : commentMap.get(r.target_id)?.user_id;
      const author = ownerId ? (ownerMap.get(ownerId) ?? null) : null;

      let targetPreview: ReportResponseDto['target_preview'] = null;
      if (r.target_type === ReportTargetType.WISH) {
        const w = wishMap.get(r.target_id);
        if (w) targetPreview = { title: w.title, description: w.description };
      } else {
        const c = commentMap.get(r.target_id);
        if (c) targetPreview = { content: c.content };
      }

      return this.toDto(r, author ? { id: author.id, pseudo: author.pseudo } : null, targetPreview);
    });

    return { data, total, page, limit };
  }

  private async getTargetOwnerId(targetType: ReportTargetType, targetId: string): Promise<string> {
    if (targetType === ReportTargetType.WISH) {
      const wish = await this.wishRepo.findOne({ where: { id: targetId } });
      if (!wish) throw new NotFoundException('Souhait introuvable');
      return wish.user_id;
    }
    const comment = await this.commentRepo.findOne({ where: { id: targetId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    return comment.user_id;
  }

  private toDto(
    report: Report,
    contentAuthor: { id: string; pseudo: string } | null,
    targetPreview: ReportResponseDto['target_preview'] = null,
  ): ReportResponseDto {
    return {
      id: report.id,
      reporter_id: report.reporter_id,
      target_type: report.target_type,
      target_id: report.target_id,
      reason: report.reason,
      details: report.details,
      target_preview: targetPreview,
      content_author: contentAuthor,
      created_at: report.created_at,
    };
  }
}
