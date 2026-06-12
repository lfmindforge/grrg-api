import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserSettingDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  value!: unknown;
}
