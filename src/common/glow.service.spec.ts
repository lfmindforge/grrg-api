import { GlowService } from './glow.service';
import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../donation/donation.types';

describe('GlowService', () => {
  let service: GlowService;

  beforeEach(() => {
    service = new GlowService();
  });

  describe('computeGrade', () => {
    it.each([
      [0, 'etincelle'],
      [1, 'etincelle'],
      [4, 'etincelle'],
      [5, 'lumiere'],
      [19, 'lumiere'],
      [20, 'eclat'],
      [49, 'eclat'],
      [50, 'bienfaiteur'],
      [99, 'bienfaiteur'],
      [100, 'mecene'],
      [199, 'mecene'],
      [200, 'legende'],
    ])('count=%i → %s', (count, expected) => {
      expect(service.computeGrade(count)).toBe(expected);
    });
  });

  describe('computeGlow', () => {
    it.each([
      [EvaluationSatisfaction.NEUTRAL, EvaluationBonus.NONE, false, 10],
      [EvaluationSatisfaction.HAPPY, EvaluationBonus.NONE, false, 20],
      [EvaluationSatisfaction.THRILLED, EvaluationBonus.NONE, false, 30],
      [EvaluationSatisfaction.NEUTRAL, EvaluationBonus.ON_TIME, false, 20],
      [EvaluationSatisfaction.NEUTRAL, EvaluationBonus.WENT_ABOVE_AND_BEYOND, false, 20],
      [EvaluationSatisfaction.NEUTRAL, EvaluationBonus.NONE, true, 50],
      [EvaluationSatisfaction.THRILLED, EvaluationBonus.WENT_ABOVE_AND_BEYOND, true, 80],
    ])('%s + %s + anon=%s → %i', (sat, bonus, anon, expected) => {
      expect(service.computeGlow(sat, bonus, anon)).toBe(expected);
    });
  });

  describe('getGradeProgression', () => {
    it('count=3 → etincelle, next=lumiere, manquants=2', () => {
      expect(service.getGradeProgression(3)).toEqual({
        currentGrade: 'etincelle',
        nextGrade: 'lumiere',
        donsManquants: 2,
      });
    });

    it('count=5 → lumiere, next=eclat, manquants=15', () => {
      expect(service.getGradeProgression(5)).toEqual({
        currentGrade: 'lumiere',
        nextGrade: 'eclat',
        donsManquants: 15,
      });
    });

    it('count=99 → bienfaiteur, next=mecene, manquants=1', () => {
      expect(service.getGradeProgression(99)).toEqual({
        currentGrade: 'bienfaiteur',
        nextGrade: 'mecene',
        donsManquants: 1,
      });
    });

    it('count=200 → legende, next=null, manquants=null', () => {
      expect(service.getGradeProgression(200)).toEqual({
        currentGrade: 'legende',
        nextGrade: null,
        donsManquants: null,
      });
    });
  });
});
