import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DonationType } from '../wish.types';

export class UpdateWishDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(DonationType)
  donation_type?: DonationType;

  // ValidateIf ignore la validation si null (null = retirer le montant)
  @IsOptional()
  @ValidateIf((o) => o.amount !== null)
  @IsNumber()
  @Min(0)
  amount?: number | null;

  @IsOptional()
  @IsBoolean()
  is_private?: boolean;
}
