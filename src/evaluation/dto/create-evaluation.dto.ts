import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../../donation/donation.types';

export class CreateEvaluationDto {
  @ApiProperty({ enum: EvaluationSatisfaction, example: EvaluationSatisfaction.HAPPY })
  @IsEnum(EvaluationSatisfaction)
  satisfaction!: EvaluationSatisfaction;

  @ApiProperty({ example: 'Très belle expérience, livraison rapide et soigneuse.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: EvaluationBonus, description: 'Bonus Glow optionnel' })
  @IsOptional()
  @IsEnum(EvaluationBonus)
  bonus?: EvaluationBonus;
}
