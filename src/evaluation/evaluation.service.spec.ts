import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EvaluationService,
  computeGrade,
  computeGlow,
} from './evaluation.service';
import { Evaluation } from '../donation/evaluation.entity';
import { Donation } from '../donation/donation.entity';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import {
  DonationStatus,
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../donation/donation.types';
import { WishStatus } from '../wish/wish.types';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let evaluationRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let donationRepo: { findOne: jest.Mock };
  let userRepo: { findOne: jest.Mock; save: jest.Mock };
  let wishRepo: { save: jest.Mock };
  let supabaseStorage: { upload: jest.Mock };
  let config: { getOrThrow: jest.Mock };

  const RECEIVER_ID = 'receiver-uuid';
  const DONOR_ID = 'donor-uuid';
  const DONATION_ID = 'donation-uuid';
  const WISH_ID = 'wish-uuid';

  const mockDonation = {
    id: DONATION_ID,
    donor_id: DONOR_ID,
    is_anonymous: false,
    status: DonationStatus.COMPLETED,
    wish: {
      id: WISH_ID,
      user_id: RECEIVER_ID,
      status: WishStatus.PENDING,
    } as Wish,
  } as Donation;

  const mockDonor = {
    id: DONOR_ID,
    glow_points: 100,
    grade: 'etincelle',
  } as User;

  const mockFile = {
    originalname: 'proof.jpg',
    buffer: Buffer.from('fake'),
    mimetype: 'image/jpeg',
  } as Express.Multer.File;

  const baseDto: CreateEvaluationDto = {
    satisfaction: EvaluationSatisfaction.HAPPY,
    description: 'Reçu en parfait état',
    bonus: EvaluationBonus.ON_TIME,
  };

  const mockEvaluation = {
    id: 'eval-uuid',
    donation_id: DONATION_ID,
    satisfaction: EvaluationSatisfaction.HAPPY,
    bonus: EvaluationBonus.ON_TIME,
    description: 'Reçu en parfait état',
    proof_url: 'https://storage.url/proof.jpg',
    glow_awarded: 30,
    created_at: new Date(),
  } as Evaluation;

  beforeEach(async () => {
    evaluationRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };
    donationRepo = { findOne: jest.fn() };
    userRepo = { findOne: jest.fn(), save: jest.fn() };
    wishRepo = { save: jest.fn() };
    supabaseStorage = { upload: jest.fn() };
    config = { getOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Donation), useValue: donationRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Wish), useValue: wishRepo },
        { provide: SupabaseStorageService, useValue: supabaseStorage },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
  });

  // ─── computeGrade ────────────────────────────────────────────────────────────

  describe('computeGrade', () => {
    it.each([
      [0, 'etincelle'],
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
    ])('computeGrade(%i) → %s', (count, expected) => {
      expect(computeGrade(count)).toBe(expected);
    });
  });

  // ─── computeGlow ─────────────────────────────────────────────────────────────

  describe('computeGlow', () => {
    it('neutral + none + non-anon = 10', () => {
      expect(
        computeGlow(EvaluationSatisfaction.NEUTRAL, EvaluationBonus.NONE, false),
      ).toBe(10);
    });

    it('happy + on_time + non-anon = 30', () => {
      expect(
        computeGlow(EvaluationSatisfaction.HAPPY, EvaluationBonus.ON_TIME, false),
      ).toBe(30);
    });

    it('thrilled + went_above_and_beyond + anon = 80', () => {
      expect(
        computeGlow(
          EvaluationSatisfaction.THRILLED,
          EvaluationBonus.WENT_ABOVE_AND_BEYOND,
          true,
        ),
      ).toBe(80);
    });
  });

  // ─── evaluate ────────────────────────────────────────────────────────────────

  describe('evaluate', () => {
    it('crée une évaluation, met à jour glow/grade/wish (happy path)', async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...mockDonor });
      evaluationRepo.count.mockResolvedValue(1);
      userRepo.save.mockResolvedValue({
        ...mockDonor,
        glow_points: 130,
        grade: 'etincelle',
      });
      wishRepo.save.mockResolvedValue({
        ...mockDonation.wish,
        status: WishStatus.FULFILLED,
      });

      const result = await service.evaluate(
        RECEIVER_ID,
        DONATION_ID,
        baseDto,
        mockFile,
      );

      expect(evaluationRepo.save).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ glow_points: 130, grade: 'etincelle' }),
      );
      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WishStatus.FULFILLED }),
      );
      expect(result.glow_awarded).toBe(30);
    });

    it('lève NotFoundException si la donation est introuvable', async () => {
      donationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si l'appelant n'est pas le receveur", async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);

      await expect(
        service.evaluate(DONOR_ID, DONATION_ID, baseDto, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si la donation n'est pas completed", async () => {
      donationRepo.findOne.mockResolvedValue({
        ...mockDonation,
        status: DonationStatus.PENDING,
      });

      await expect(
        service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève ConflictException si une évaluation existe déjà', async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(mockEvaluation);

      await expect(
        service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile),
      ).rejects.toThrow(ConflictException);
    });

    it('lève BadRequestException si aucun fichier proof fourni', async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
