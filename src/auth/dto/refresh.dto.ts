import { IsString } from 'class-validator';
//utilisé par auth/refresh et auth/logout.
export class RefreshDto {
  @IsString()
  refresh_token!: string;
}
