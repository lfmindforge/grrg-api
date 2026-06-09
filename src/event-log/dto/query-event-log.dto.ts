import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '../event-log.types';

export class QueryEventLogDto {
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
