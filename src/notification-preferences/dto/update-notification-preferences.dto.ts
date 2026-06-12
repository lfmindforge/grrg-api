import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  donation_received?: boolean;

  @IsBoolean()
  @IsOptional()
  evaluation_received?: boolean;
}
