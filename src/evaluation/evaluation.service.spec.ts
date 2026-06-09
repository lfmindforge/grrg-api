import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvaluationService } from './evaluation.service';
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
import { DonationType, WishStatus } from '../wish/wish.types';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { GlowService } from '../common/glow.service';
import { NotificationService } from '../notifications/notification.service';
import { BadgeService } from '../badge/badge.service';
import { BadgeType } from '../badge/badge.types';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let evaluationRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let donationRepo: { findOne: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock; save: jest.Mock };
  let wishRepo: { save: jest.Mock };
  let supabaseStorage: { upload: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let glowService: {
    computeGlow: jest.Mock;
    computeGrade: jest.Mock;
    getGradeProgression: jest.Mock;
  };
  let notificationService: { notify: jest.Mock };
  let badgeService: { award: jest.Mock };
  let mockEventService: { log: jest.Mock };

  const RECEIVER_ID = 'receiver-uuid';
  const DONOR_ID = 'donor-uuid';
  const DONATION_ID = 'donation-uuid';
  const WISH_ID = 'wish-uuid';

  const mockDonation = {
    id: DONATION_ID,
    donor_id: DONOR_ID,
    type: DonationType.DELIVERY,
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
    donationRepo = { findOne: jest.fn(), save: jest.fn() };
    userRepo = { findOne: jest.fn(), save: jest.fn() };
    wishRepo = { save: jest.fn() };
    supabaseStorage = { upload: jest.fn() };
    config = { getOrThrow: jest.fn() };
    glowService = {
      computeGlow: jest.fn().mockReturnValue(30),
      computeGrade: jest.fn().mockReturnValue('etincelle'),
      getGradeProgression: jest.fn().mockReturnValue({
        currentGrade: 'etincelle',
        nextGrade: 'lumiere',
        donsManquants: 4,
      }),
    };
    notificationService = { notify: jest.fn().mockResolvedValue(undefined) };
    badgeService = { award: jest.fn().mockResolvedValue(undefined) };
    mockEventService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Donation), useValue: donationRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Wish), useValue: wishRepo },
        { provide: SupabaseStorageService, useValue: supabaseStorage },
        { provide: ConfigService, useValue: config },
        { provide: GlowService, useValue: glowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: BadgeService, useValue: badgeService },
        { provide: EventLogService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
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

      expect(glowService.computeGlow).toHaveBeenCalledWith(
        baseDto.satisfaction,
        baseDto.bonus,
        false,
        DonationType.DELIVERY,
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

    it('envoie evaluation_received au donateur avec glow_awarded et pseudo du receveur', async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...mockDonor, pseudo: 'Receiver' });
      evaluationRepo.count.mockResolvedValue(1);
      glowService.computeGrade.mockReturnValue('etincelle');
      userRepo.save.mockResolvedValue({ ...mockDonor, glow_points: 130 });
      wishRepo.save.mockResolvedValue({});

      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      expect(notificationService.notify).toHaveBeenCalledWith(
        DONOR_ID,
        'evaluation_received',
        expect.objectContaining({ glow_awarded: 30, recipient_pseudo: 'Receiver', wish_id: WISH_ID }),
      );
    });

    it('envoie grade_up en plus de evaluation_received si le grade change', async () => {
      const donorAtEtincelle = { ...mockDonor, grade: 'etincelle', glow_points: 80 };
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...donorAtEtincelle, pseudo: 'Receiver' });
      evaluationRepo.count.mockResolvedValue(5);
      glowService.computeGrade.mockReturnValue('lumiere');
      userRepo.save.mockResolvedValue({ ...donorAtEtincelle, glow_points: 110, grade: 'lumiere' });
      wishRepo.save.mockResolvedValue({});

      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      expect(notificationService.notify).toHaveBeenCalledWith(
        DONOR_ID,
        'grade_up',
        expect.objectContaining({ grade: 'lumiere', previous_grade: 'etincelle' }),
      );
    });

    it("n'envoie pas grade_up si le grade n'a pas changé", async () => {
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...mockDonor, pseudo: 'Receiver' });
      evaluationRepo.count.mockResolvedValue(1);
      glowService.computeGrade.mockReturnValue('etincelle'); // même grade
      userRepo.save.mockResolvedValue({ ...mockDonor, glow_points: 130 });
      wishRepo.save.mockResolvedValue({});

      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      const gradeCalls = notificationService.notify.mock.calls.filter((c: unknown[]) => c[1] === 'grade_up');
      expect(gradeCalls).toHaveLength(0);
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

    it("auto-confirme une donation pending avant de créer l'évaluation", async () => {
      const pendingDonation = {
        ...mockDonation,
        status: DonationStatus.PENDING,
      };
      donationRepo.findOne.mockResolvedValue(pendingDonation);
      donationRepo.save.mockResolvedValue({
        ...pendingDonation,
        status: DonationStatus.COMPLETED,
      });
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...mockDonor });
      evaluationRepo.count.mockResolvedValue(1);
      userRepo.save.mockResolvedValue({ ...mockDonor, glow_points: 130 });
      wishRepo.save.mockResolvedValue({});

      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      expect(donationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DonationStatus.COMPLETED }),
      );
      expect(evaluationRepo.save).toHaveBeenCalled();
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

  describe('evaluate() — badges', () => {
    beforeEach(() => {
      donationRepo.findOne.mockResolvedValue({ ...mockDonation, is_anonymous: false });
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue({ ...mockEvaluation });
      evaluationRepo.save.mockResolvedValue({ ...mockEvaluation });
      userRepo.findOne.mockResolvedValue({ ...mockDonor });
      evaluationRepo.count.mockResolvedValue(1);
      userRepo.save.mockResolvedValue({ ...mockDonor, glow_points: 130 });
      wishRepo.save.mockResolvedValue({});
      notificationService.notify.mockResolvedValue(undefined);
    });

    it('attribue mystery_anonymous si le don est anonyme', async () => {
      donationRepo.findOne.mockResolvedValue({ ...mockDonation, is_anonymous: true });

      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      expect(badgeService.award).toHaveBeenCalledWith(DONOR_ID, BadgeType.MYSTERY_ANONYMOUS);
    });

    it("n'attribue pas mystery_anonymous si le don n'est pas anonyme", async () => {
      await service.evaluate(RECEIVER_ID, DONATION_ID, baseDto, mockFile);

      expect(badgeService.award).not.toHaveBeenCalledWith(DONOR_ID, BadgeType.MYSTERY_ANONYMOUS);
    });

    it('attribue most_improbable_wish si went_above_and_beyond + thrilled', async () => {
      const dto: CreateEvaluationDto = {
        satisfaction: EvaluationSatisfaction.THRILLED,
        bonus: EvaluationBonus.WENT_ABOVE_AND_BEYOND,
        description: 'Incroyable',
      };
      evaluationRepo.save.mockResolvedValue({
        ...mockEvaluation,
        bonus: EvaluationBonus.WENT_ABOVE_AND_BEYOND,
        satisfaction: EvaluationSatisfaction.THRILLED,
      });

      await service.evaluate(RECEIVER_ID, DONATION_ID, dto, mockFile);

      expect(badgeService.award).toHaveBeenCalledWith(DONOR_ID, BadgeType.MOST_IMPROBABLE_WISH);
    });

    it("n'attribue pas most_improbable_wish si satisfaction < thrilled", async () => {
      const dto: CreateEvaluationDto = {
        satisfaction: EvaluationSatisfaction.HAPPY,
        bonus: EvaluationBonus.WENT_ABOVE_AND_BEYOND,
        description: 'Bien',
      };
      evaluationRepo.save.mockResolvedValue({
        ...mockEvaluation,
        bonus: EvaluationBonus.WENT_ABOVE_AND_BEYOND,
        satisfaction: EvaluationSatisfaction.HAPPY,
      });

      await service.evaluate(RECEIVER_ID, DONATION_ID, dto, mockFile);

      expect(badgeService.award).not.toHaveBeenCalledWith(DONOR_ID, BadgeType.MOST_IMPROBABLE_WISH);
    });
  });

  // --- événements ---

  describe('événements EventLog', () => {
    it('log EVALUATION_CREATE avec satisfaction et glow_awarded', async () => {
      const dto: CreateEvaluationDto = { satisfaction: EvaluationSatisfaction.HAPPY, description: 'Super', bonus: EvaluationBonus.ON_TIME };
      donationRepo.findOne.mockResolvedValue(mockDonation);
      evaluationRepo.findOne.mockResolvedValue(null);
      config.getOrThrow.mockReturnValue('evaluations-proof');
      supabaseStorage.upload.mockResolvedValue('https://storage.url/proof.jpg');
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      userRepo.findOne.mockResolvedValue({ ...mockDonor });
      evaluationRepo.count.mockResolvedValue(1);
      userRepo.save.mockResolvedValue({ ...mockDonor, glow_points: 130 });
      wishRepo.save.mockResolvedValue({});

      await service.evaluate(RECEIVER_ID, DONATION_ID, dto, mockFile);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.EVALUATION_CREATE,
        RECEIVER_ID,
        expect.objectContaining({ donation_id: DONATION_ID, satisfaction: EvaluationSatisfaction.HAPPY, glow_awarded: 30, wish_id: WISH_ID }),
      );
    });
  });
});
