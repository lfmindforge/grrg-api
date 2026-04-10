import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../../donation/donation.types';

export class EvaluationResponseDto {
  id!: string;
  donation_id!: string;
  satisfaction!: EvaluationSatisfaction;
  bonus!: EvaluationBonus;
  description!: string;
  proof_url!: string | null;
  glow_awarded!: number;
  created_at!: Date;
}
