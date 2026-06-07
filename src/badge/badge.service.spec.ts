import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadgeService } from './badge.service';
import { Badge } from './badge.entity';
import { Evaluation } from '../donation/evaluation.entity';
import { BadgeType } from './badge.types';
import { NotificationService } from '../notifications/notification.service';

describe('BadgeService', () => {
  let service: BadgeService;
  let badgeRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let evaluationRepo: { createQueryBuilder: jest.Mock };
  let notificationService: { notify: jest.Mock };
  let mockQb: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    getRawMany: jest.Mock;
  };

  const USER_ID = 'user-uuid';

  beforeEach(async () => {
    mockQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    badgeRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ ...d, id: 'badge-uuid' })),
      find: jest.fn(),
    };
    evaluationRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) };
    notificationService = { notify: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        { provide: getRepositoryToken(Badge), useValue: badgeRepo },
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(BadgeService);
  });

  describe('award()', () => {
    it('insère le badge avec count=1 si inexistant', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      await service.award(USER_ID, BadgeType.MYSTERY_ANONYMOUS);
      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          badge_type: BadgeType.MYSTERY_ANONYMOUS,
          period: null,
          count: 1,
        }),
      );
    });

    it('incrémente le count si le badge existe déjà', async () => {
      badgeRepo.findOne.mockResolvedValue({ id: 'existing', count: 2 });
      await service.award(USER_ID, BadgeType.MYSTERY_ANONYMOUS);
      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'existing', count: 3 }),
      );
    });

    it('insère biggest_donor_month avec count=1 pour un nouveau period', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      await service.award(USER_ID, BadgeType.BIGGEST_DONOR_MONTH, '2026-06');
      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ period: '2026-06', badge_type: BadgeType.BIGGEST_DONOR_MONTH, count: 1 }),
      );
    });

    it('incrémente biggest_donor_month si le même period existe', async () => {
      badgeRepo.findOne.mockResolvedValue({ id: 'existing', count: 1 });
      await service.award(USER_ID, BadgeType.BIGGEST_DONOR_MONTH, '2026-06');
      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'existing', count: 2 }),
      );
    });

    it('envoie badge_earned au premier obtention du badge', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      badgeRepo.create.mockReturnValue({ user_id: USER_ID, badge_type: 'fastest_donor', count: 1 });
      badgeRepo.save.mockResolvedValue({});

      await service.award(USER_ID, BadgeType.FASTEST_DONOR);

      expect(notificationService.notify).toHaveBeenCalledWith(
        USER_ID,
        'badge_earned',
        { badge_type: 'fastest_donor' },
      );
    });

    it("n'envoie pas badge_earned si le badge existe déjà (incrément count)", async () => {
      badgeRepo.findOne.mockResolvedValue({ user_id: USER_ID, badge_type: 'fastest_donor', count: 1 });
      badgeRepo.save.mockResolvedValue({});

      await service.award(USER_ID, BadgeType.FASTEST_DONOR);

      expect(notificationService.notify).not.toHaveBeenCalled();
    });
  });

  describe('findByUser()', () => {
    it('retourne les badges du user triés par earned_at DESC', async () => {
      const fakeBadges = [{ id: '1', badge_type: 'fastest_donor' }];
      badgeRepo.find.mockResolvedValue(fakeBadges);
      const result = await service.findByUser(USER_ID);
      expect(badgeRepo.find).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        order: { earned_at: 'DESC' },
      });
      expect(result).toEqual(fakeBadges);
    });
  });

  describe('awardMonthlyBiggestDonor()', () => {
    it('attribue le badge au donateur avec le plus de glow sur le mois précédent', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { donor_id: 'user-a', total_glow: '120' },
        { donor_id: 'user-b', total_glow: '80' },
      ]);
      badgeRepo.findOne.mockResolvedValue(null);
      await service.awardMonthlyBiggestDonor();
      expect(badgeRepo.save).toHaveBeenCalledTimes(1);
      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-a', badge_type: BadgeType.BIGGEST_DONOR_MONTH }),
      );
    });

    it('gère les ex aequo : attribue à tous les gagnants', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { donor_id: 'user-a', total_glow: '100' },
        { donor_id: 'user-b', total_glow: '100' },
      ]);
      badgeRepo.findOne.mockResolvedValue(null);
      await service.awardMonthlyBiggestDonor();
      expect(badgeRepo.save).toHaveBeenCalledTimes(2);
    });

    it('ne fait rien si aucune évaluation ce mois', async () => {
      mockQb.getRawMany.mockResolvedValue([]);
      await service.awardMonthlyBiggestDonor();
      expect(badgeRepo.save).not.toHaveBeenCalled();
    });
  });
});
