import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../event-log.types';

export class QueryEventLogDto {
  @ApiPropertyOptional({ enum: EventType, description: 'Filtrer par type d\'événement' })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ description: 'Filtrer par pseudo de l\'acteur' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pseudo?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Date de début (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Date de fin (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
