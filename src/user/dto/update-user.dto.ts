import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pseudo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;
}
