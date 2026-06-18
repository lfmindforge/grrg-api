import { Injectable } from '@nestjs/common';
import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../donation/donation.types';
import { DonationType } from '../wish/wish.types';

export type GradeProgression = {
  currentGrade: string;
  nextGrade: string | null;
  donsManquants: number | null;
};

// Seuils des grades du plus haut au plus bas — ordre nécessaire pour find()
const GRADE_THRESHOLDS: Array<{ grade: string; min: number }> = [
  { grade: 'legende', min: 200 },
  { grade: 'mecene', min: 100 },
  { grade: 'bienfaiteur', min: 50 },
  { grade: 'eclat', min: 20 },
  { grade: 'lumiere', min: 5 },
  { grade: 'etincelle', min: 0 },
];

@Injectable()
export class GlowService {
  computeGlow(
    satisfaction: EvaluationSatisfaction,
    bonus: EvaluationBonus,
    donationType: DonationType,
  ): number {
    const satPoints: Record<EvaluationSatisfaction, number> = {
      [EvaluationSatisfaction.NEUTRAL]: 10,
      [EvaluationSatisfaction.HAPPY]: 20,
      [EvaluationSatisfaction.THRILLED]: 30,
    };
    const bonusPoints: Record<EvaluationBonus, number> = {
      [EvaluationBonus.NONE]: 0,
      [EvaluationBonus.ON_TIME]: 10,
      [EvaluationBonus.WENT_ABOVE_AND_BEYOND]: 10,
    };
    const typePoints: Record<DonationType, number> = {
      [DonationType.IN_PERSON]: 35,
      [DonationType.DELIVERY]: 20,
      [DonationType.FINANCIAL]: 10,
    };
    return (
      satPoints[satisfaction] +
      bonusPoints[bonus] +
      typePoints[donationType]
    );
  }

  computeGrade(count: number): string {
    return GRADE_THRESHOLDS.find((t) => count >= t.min)?.grade ?? 'etincelle';
  }

  getGradeProgression(count: number): GradeProgression {
    const currentGrade = this.computeGrade(count);
    if (currentGrade === 'legende') {
      return { currentGrade, nextGrade: null, donsManquants: null };
    }
    const currentIndex = GRADE_THRESHOLDS.findIndex(
      (t) => t.grade === currentGrade,
    );
    const next = GRADE_THRESHOLDS[currentIndex - 1];
    return {
      currentGrade,
      nextGrade: next.grade,
      donsManquants: next.min - count,
    };
  }
}
