import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { DonationType } from '../../wish/wish.types';

export class CreateDonationDto {
  @IsUUID()
  wish_id!: string;

  @IsEnum(DonationType)
  type!: DonationType;

  // Requis uniquement si type=financial
  @ValidateIf((o: CreateDonationDto) => o.type === DonationType.FINANCIAL)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  // Requis uniquement si type=delivery ou in_person
  @ValidateIf((o: CreateDonationDto) => o.type !== DonationType.FINANCIAL)
  @IsString()
  @IsNotEmpty()
  nature_description?: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}
