import { ReportReason, ReportTargetType } from './report.entity';

export interface ReportResponseDto {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  created_at: Date;
}

export interface PaginatedReportsDto {
  data: ReportResponseDto[];
  total: number;
  page: number;
  limit: number;
}
