export enum BadgeType {
  MYSTERY_ANONYMOUS = 'mystery_anonymous',
  MOST_IMPROBABLE_WISH = 'most_improbable_wish',
  FASTEST_DONOR = 'fastest_donor',
  BIGGEST_DONOR_MONTH = 'biggest_donor_month',
}

export interface BadgeDto {
  badge_type: string;
  period: string | null;
  earned_at: Date;
  count: number;
}
