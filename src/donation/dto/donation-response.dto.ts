import { DonationType } from '../../wish/wish.types';
import { DonationStatus } from '../donation.types';

export class DonationResponseDto {
  id!: string;
  wish_id!: string;
  donor_id!: string;
  type!: DonationType;
  amount!: number | null;
  nature_description!: string | null;
  status!: DonationStatus;
  created_at!: Date;
}
