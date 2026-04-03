import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MinLength,
  IsISO8601,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'pseudo ne peut contenir que des lettres, chiffres, tirets et underscores',
  })
  pseudo!: string;

  @IsISO8601({ strict: true })
  birthdate!: string;
}
