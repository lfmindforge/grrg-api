import { DonationType } from '../../wish/wish.types';
import { DonationStatus, EvaluationBonus, EvaluationSatisfaction } from '../donation.types';

export class WishPreviewInDonationDto {
  id!: string;
  title!: string;
  category!: string;
  media_urls!: string[];   // le frontend utilise media_urls[0] comme cover
}

export class EvaluationSummaryInDonationDto {
  glow_awarded!: number;
  satisfaction!: EvaluationSatisfaction;
  bonus!: EvaluationBonus;
}

export class DonationHistoryItemDto {
  id!: string;
  type!: DonationType;
  status!: DonationStatus;
  amount!: number | null;
  nature_description!: string | null;
  is_anonymous!: boolean;
  created_at!: Date;
  wish!: WishPreviewInDonationDto;
  evaluation!: EvaluationSummaryInDonationDto | null;
}
