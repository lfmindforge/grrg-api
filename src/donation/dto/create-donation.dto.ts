import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DonationType } from '../../wish/wish.types';

export class CreateDonationDto {
  @ApiProperty({ example: 'uuid-du-souhait', format: 'uuid' })
  @IsUUID()
  wish_id!: string;

  @ApiProperty({ enum: DonationType, example: DonationType.FINANCIAL })
  @IsEnum(DonationType)
  type!: DonationType;

  // Requis uniquement si type=financial
  @ApiPropertyOptional({ example: 25.00, description: 'Montant en euros (type=financial uniquement)', minimum: 0.01 })
  @ValidateIf((o: CreateDonationDto) => o.type === DonationType.FINANCIAL)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  // Requis uniquement si type=delivery ou in_person
  @ApiPropertyOptional({ example: 'Je vous apporte un gâteau fait maison', description: 'Requis si type != financial' })
  @ValidateIf((o: CreateDonationDto) => o.type !== DonationType.FINANCIAL)
  @IsString()
  @IsNotEmpty()
  nature_description?: string;

}
