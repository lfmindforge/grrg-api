import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../../donation/donation.types';

export class CreateEvaluationDto {
  @IsEnum(EvaluationSatisfaction)
  satisfaction!: EvaluationSatisfaction;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsEnum(EvaluationBonus)
  bonus?: EvaluationBonus;
}
