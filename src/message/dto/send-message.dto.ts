import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  recipient_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
