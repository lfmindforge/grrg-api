import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DonationType, WishStatus } from '../wish.types';

export class QueryWishDto {
  // Les query params arrivent en string — @Type convertit en number
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(DonationType)
  donation_type?: DonationType;

  @IsOptional()
  @IsEnum(WishStatus)
  status?: WishStatus;

  @IsOptional()
  @IsIn(['date', 'amount', 'popularity'])
  sort?: 'date' | 'amount' | 'popularity';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
