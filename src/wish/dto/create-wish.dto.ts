import { IsBoolean, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWishDto {
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsNotEmpty()
  description!: string;

  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  // Multipart envoie "true"/"false" en string — @Transform normalise en boolean
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_private?: boolean;
}
