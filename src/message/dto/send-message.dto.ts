import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { NoPersonalInfo } from './no-personal-info.validator';

export class SendMessageDto {
  @IsUUID()
  recipient_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @NoPersonalInfo()
  content!: string;
}
