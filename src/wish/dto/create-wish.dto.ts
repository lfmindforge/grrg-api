import { IsBoolean, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWishDto {
  @ApiProperty({ example: 'Un vélo électrique', maxLength: 100 })
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ example: 'Je rêve d\'un vélo pour mes trajets quotidiens.' })
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 'transport', maxLength: 50 })
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  // Multipart envoie "true"/"false" en string — @Transform normalise en boolean
  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_private?: boolean;
}
