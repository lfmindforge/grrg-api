import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DonationType } from '../wish.types';

export class CreateWishDto {
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsNotEmpty()
  description!: string;

  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @IsEnum(DonationType)
  donation_type!: DonationType;

  // Multipart envoie tout en string — @Type convertit en number
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  // Multipart envoie "true"/"false" en string — @Transform normalise en boolean
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_private?: boolean;
}
