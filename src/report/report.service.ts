import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportTargetType } from './report.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
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

    return this.toDto(saved);
  }

  async getReports(dto: QueryReportsDto): Promise<PaginatedReportsDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.reportRepo
      .createQueryBuilder('report')
      .orderBy('report.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (dto.target_type) {
      qb.where('report.target_type = :type', { type: dto.target_type });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data: data.map((r) => this.toDto(r)), total, page, limit };
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

  private toDto(report: Report): ReportResponseDto {
    return {
      id: report.id,
      reporter_id: report.reporter_id,
      target_type: report.target_type,
      target_id: report.target_id,
      reason: report.reason,
      details: report.details,
      created_at: report.created_at,
    };
  }
}
