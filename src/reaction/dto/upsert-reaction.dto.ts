import { IsString, Length } from 'class-validator';

export class UpsertReactionDto {
  @IsString()
  @Length(1, 10)
  emoji!: string;
}
