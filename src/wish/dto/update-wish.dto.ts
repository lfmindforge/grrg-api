import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @IsBoolean()
  is_private?: boolean;
}
