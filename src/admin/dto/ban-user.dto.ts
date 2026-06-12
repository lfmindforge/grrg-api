import { IsDateString, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BanUserDto {
  @ApiProperty({ description: 'Date ISO ou "9999-12-31" pour ban définitif' })
  @IsDateString()
  until!: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  reason!: string;
}
