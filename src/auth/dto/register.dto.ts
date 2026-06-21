import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  IsISO8601,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Alice42', minLength: 3, maxLength: 50 })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'pseudo ne peut contenir que des lettres, chiffres, tirets et underscores',
  })
  pseudo!: string;

  @ApiProperty({ example: '1995-06-15', description: 'Date de naissance ISO8601 (18 ans minimum)' })
  @IsISO8601({ strict: true })
  birthdate!: string;

  @ApiProperty({ example: 'Bruxelles', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;
}
