import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DonationService } from './donation.service';
import { Donation } from './donation.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { DonationType, WishStatus } from '../wish/wish.types';
import { DonationStatus } from './donation.types';
import { CreateDonationDto } from './dto/create-donation.dto';
import { BadgeService } from '../badge/badge.service';
import { BadgeType } from '../badge/badge.types';
import { NotificationService } from '../notifications/notification.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';
import { MessageService } from '../message/message.service';

describe('DonationService', () => {
  let service: DonationService;
  let donationRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let wishRepo: { findOne: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let badgeService: { award: jest.Mock };
  let notificationService: { notify: jest.Mock };
  let mockEventService: { log: jest.Mock };
  let mockMessageService: { sendMessage: jest.Mock };

  let mockQb: {
    innerJoinAndSelect: jest.Mock;
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const DONOR_ID = 'donor-uuid';
  const OWNER_ID = 'owner-uuid';
  const WISH_ID = 'wish-uuid';

  const mockWish = {
    id: WISH_ID,
    user_id: OWNER_ID,
    title: 'Test souhait',
    status: WishStatus.PENDING,
    created_at: new Date(Date.now() - 2 * 3600 * 1000), // 2h ago — ne déclenche pas fastest_donor
  } as Wish;

  beforeEach(async () => {
    mockQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    donationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(2), // défaut : 2e don — ne déclenche pas fastest_donor
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
    wishRepo = { findOne: jest.fn(), save: jest.fn() };
    userRepo = { findOne: jest.fn().mockResolvedValue({ pseudo: 'DonorPseudo' }) };
    badgeService = { award: jest.fn().mockResolvedValue(undefined) };
    notificationService = { notify: jest.fn().mockResolvedValue(undefined) };
    mockEventService = { log: jest.fn().mockResolvedValue(undefined) };
    mockMessageService = { sendMessage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationService,
        { provide: getRepositoryToken(Donation), useValue: donationRepo },
        { provide: getRepositoryToken(Wish), useValue: wishRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: BadgeService, useValue: badgeService },
        { provide: NotificationService, useValue: notificationService },
        { provide: EventLogService, useValue: mockEventService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile();

    service = module.get<DonationService>(DonationService);
  });

  describe('propose', () => {
    it('crée une donation financial avec amount', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 50,
      };
      const created = {
        id: 'don-uuid',
        ...dto,
        donor_id: DONOR_ID,
        status: DonationStatus.PENDING,
      };
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      donationRepo.create.mockReturnValue(created);
      donationRepo.save.mockResolvedValue(created);
      wishRepo.save.mockResolvedValue({ ...mockWish, status: WishStatus.IN_PROGRESS });

      const result = await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wish_id: WISH_ID,
          donor_id: DONOR_ID,
          type: DonationType.FINANCIAL,
          amount: 50,
          nature_description: null,
          status: DonationStatus.PENDING,
        }),
      );
      expect(result.status).toBe(DonationStatus.PENDING);
    });

    it('lève NotFoundException si le souhait est introuvable', async () => {
      wishRepo.findOne.mockResolvedValue(null);
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 10,
      };

      await expect(service.propose(DONOR_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève BadRequestException si le souhait n'est pas en status pending", async () => {
      wishRepo.findOne.mockResolvedValue({
        ...mockWish,
        status: WishStatus.FULFILLED,
      });
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 10,
      };

      await expect(service.propose(DONOR_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève ForbiddenException si le donateur est le créateur du souhait', async () => {
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 10,
      };

      await expect(service.propose(OWNER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('met amount à null pour type delivery', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.DELIVERY,
        nature_description: 'Un vélo',
      };
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      donationRepo.create.mockReturnValue({ ...dto, donor_id: DONOR_ID });
      donationRepo.save.mockResolvedValue({ ...dto, donor_id: DONOR_ID });
      wishRepo.save.mockResolvedValue({ ...mockWish, status: WishStatus.IN_PROGRESS });

      await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: null,
          nature_description: 'Un vélo',
        }),
      );
    });

    it('met amount à null et enregistre nature_description pour type in_person', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.IN_PERSON,
        nature_description: 'Cours de guitare',
      };
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      donationRepo.create.mockReturnValue({ ...dto, donor_id: DONOR_ID });
      donationRepo.save.mockResolvedValue({
        ...dto,
        donor_id: DONOR_ID,
        status: DonationStatus.PENDING,
      });
      wishRepo.save.mockResolvedValue({ ...mockWish, status: WishStatus.IN_PROGRESS });

      await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: null,
          nature_description: 'Cours de guitare',
          type: DonationType.IN_PERSON,
        }),
      );
    });

    it('passe le souhait en IN_PROGRESS après avoir enregistré le don', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 50,
      };
      const created = {
        id: 'don-uuid',
        ...dto,
        donor_id: DONOR_ID,
        status: DonationStatus.PENDING,
      };
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      donationRepo.create.mockReturnValue(created);
      donationRepo.save.mockResolvedValue(created);
      wishRepo.save.mockResolvedValue({
        ...mockWish,
        status: WishStatus.IN_PROGRESS,
      });

      await service.propose(DONOR_ID, dto);

      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WishStatus.IN_PROGRESS }),
      );
    });

    it('envoie donation_received au créateur du souhait', async () => {
      const dto: CreateDonationDto = { wish_id: WISH_ID, type: DonationType.FINANCIAL, amount: 50 };
      const created = { id: 'don-uuid', wish_id: WISH_ID, donor_id: DONOR_ID, status: DonationStatus.PENDING };
      wishRepo.findOne.mockResolvedValue({ ...mockWish, title: 'Je veux un vélo' });
      donationRepo.create.mockReturnValue(created);
      donationRepo.save.mockResolvedValue(created);
      wishRepo.save.mockResolvedValue({});

      await service.propose(DONOR_ID, dto);

      expect(notificationService.notify).toHaveBeenCalledWith(
        OWNER_ID,
        'donation_received',
        expect.objectContaining({ donor_pseudo: 'DonorPseudo', wish_id: WISH_ID }),
      );
    });
  });

  describe('confirm', () => {
    const DONATION_ID = 'donation-uuid';

    const mockDonationPending = {
      id: DONATION_ID,
      wish_id: WISH_ID,
      donor_id: DONOR_ID,
      type: DonationType.DELIVERY,
      amount: null,
      nature_description: 'Un vélo',
      is_anonymous: false,
      status: DonationStatus.PENDING,
      wish: { id: WISH_ID, user_id: OWNER_ID } as Wish,
      created_at: new Date(),
    } as Donation;

    it('transitions une donation pending vers completed', async () => {
      const saved = {
        ...mockDonationPending,
        status: DonationStatus.COMPLETED,
      };
      donationRepo.findOne.mockResolvedValue(mockDonationPending);
      donationRepo.save.mockResolvedValue(saved);

      const result = await service.confirm(OWNER_ID, DONATION_ID);

      expect(donationRepo.findOne).toHaveBeenCalledWith({
        where: { id: DONATION_ID },
        relations: { wish: true },
      });
      expect(donationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DonationStatus.COMPLETED }),
      );
      expect(result.status).toBe(DonationStatus.COMPLETED);
    });

    it('lève NotFoundException si la donation est introuvable', async () => {
      donationRepo.findOne.mockResolvedValue(null);

      await expect(service.confirm(OWNER_ID, DONATION_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève ForbiddenException si l'appelant n'est pas le receveur du souhait", async () => {
      donationRepo.findOne.mockResolvedValue(mockDonationPending);

      await expect(service.confirm(DONOR_ID, DONATION_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lève BadRequestException si la donation est déjà completed', async () => {
      donationRepo.findOne.mockResolvedValue({
        ...mockDonationPending,
        status: DonationStatus.COMPLETED,
      });

      await expect(service.confirm(OWNER_ID, DONATION_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findMyDonations', () => {
    it('retourne les donations avec wish et evaluation chargées', async () => {
      const donations = [
        {
          id: 'don-1',
          donor_id: DONOR_ID,
          wish: {
            id: WISH_ID,
            title: "Je rêve d'un vélo",
            category: 'sport',
            media_urls: ['https://img.jpg'],
          },
          evaluation: {
            glow_awarded: 30,
            satisfaction: 'happy',
            bonus: 'on_time',
          },
          status: DonationStatus.COMPLETED,
          created_at: new Date(),
        },
      ];
      donationRepo.find.mockResolvedValue(donations);

      const result = await service.findMyDonations(DONOR_ID);

      expect(donationRepo.find).toHaveBeenCalledWith({
        where: { donor_id: DONOR_ID },
        relations: { wish: true, evaluation: true },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual(donations);
    });

    it('retourne les donations avec evaluation null si non évaluée', async () => {
      const donations = [
        {
          id: 'don-1',
          donor_id: DONOR_ID,
          wish: {
            id: WISH_ID,
            title: 'Souhait',
            category: 'sport',
            media_urls: [],
          },
          evaluation: null,
          status: DonationStatus.PENDING,
          created_at: new Date(),
        },
      ];
      donationRepo.find.mockResolvedValue(donations);

      const result = await service.findMyDonations(DONOR_ID);

      expect(result[0].evaluation).toBeNull();
    });

    it('retourne un tableau vide si aucun don', async () => {
      donationRepo.find.mockResolvedValue([]);

      const result = await service.findMyDonations(DONOR_ID);

      expect(result).toEqual([]);
    });
  });

  describe('propose() — badge fastest_donor', () => {
    const recentWish = {
      id: WISH_ID,
      user_id: OWNER_ID,
      title: 'Souhait récent',
      status: WishStatus.PENDING,
      created_at: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    };
    const dto: CreateDonationDto = {
      wish_id: WISH_ID,
      type: DonationType.FINANCIAL,
      amount: 10,
      is_anonymous: false,
    };

    it('attribue fastest_donor si 1er don sur souhait posté depuis < 1h', async () => {
      wishRepo.findOne.mockResolvedValue({ ...recentWish });
      donationRepo.create.mockReturnValue({ id: 'don-uuid' });
      donationRepo.save.mockResolvedValue({ id: 'don-uuid', wish_id: WISH_ID });
      donationRepo.count.mockResolvedValue(1);
      wishRepo.save.mockResolvedValue({});

      await service.propose(DONOR_ID, dto);

      expect(badgeService.award).toHaveBeenCalledWith(DONOR_ID, BadgeType.FASTEST_DONOR);
    });

    it("n'attribue pas fastest_donor si ce n'est pas le 1er don", async () => {
      wishRepo.findOne.mockResolvedValue({ ...recentWish });
      donationRepo.create.mockReturnValue({ id: 'don-uuid' });
      donationRepo.save.mockResolvedValue({ id: 'don-uuid', wish_id: WISH_ID });
      donationRepo.count.mockResolvedValue(2);
      wishRepo.save.mockResolvedValue({});

      await service.propose(DONOR_ID, dto);

      expect(badgeService.award).not.toHaveBeenCalled();
    });

    it("n'attribue pas fastest_donor si le souhait a plus d'1h", async () => {
      const oldWish = { ...recentWish, created_at: new Date(Date.now() - 2 * 3600 * 1000) };
      wishRepo.findOne.mockResolvedValue({ ...oldWish });
      donationRepo.create.mockReturnValue({ id: 'don-uuid' });
      donationRepo.save.mockResolvedValue({ id: 'don-uuid', wish_id: WISH_ID });
      donationRepo.count.mockResolvedValue(1);
      wishRepo.save.mockResolvedValue({});

      await service.propose(DONOR_ID, dto);

      expect(badgeService.award).not.toHaveBeenCalled();
    });
  });

  describe('findReceived', () => {
    const OWNER_ID = 'owner-uuid';

    it('retourne les donations non évaluées des souhaits du receveur', async () => {
      const donations = [
        {
          id: 'don-1',
          wish_id: WISH_ID,
          wish: { id: WISH_ID, title: 'Je veux un vélo' },
          type: DonationType.FINANCIAL,
          is_anonymous: false,
          status: DonationStatus.PENDING,
        },
      ];
      mockQb.getMany.mockResolvedValue(donations);

      const result = await service.findReceived(OWNER_ID);

      expect(donationRepo.createQueryBuilder).toHaveBeenCalledWith('donation');
      expect(mockQb.innerJoinAndSelect).toHaveBeenCalledWith(
        'donation.wish',
        'wish',
      );
      expect(mockQb.leftJoin).toHaveBeenCalledWith(
        'donation.evaluation',
        'evaluation',
      );
      expect(mockQb.where).toHaveBeenCalledWith('wish.user_id = :userId', {
        userId: OWNER_ID,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('evaluation.id IS NULL');
      expect(result).toEqual(donations);
    });

    it('retourne un tableau vide si aucun don non évalué', async () => {
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.findReceived(OWNER_ID);

      expect(result).toEqual([]);
    });
  });

  // --- événements ---

  describe('événements EventLog', () => {
    it('log DONATION_CREATE après la sauvegarde', async () => {
      const dto: CreateDonationDto = { wish_id: WISH_ID, type: DonationType.FINANCIAL, amount: 50, is_anonymous: false };
      const created = { id: 'don-uuid', ...dto, donor_id: DONOR_ID, status: DonationStatus.PENDING, is_anonymous: false };
      wishRepo.findOne.mockResolvedValue({ ...mockWish });
      donationRepo.create.mockReturnValue(created);
      donationRepo.save.mockResolvedValue(created);
      wishRepo.save.mockResolvedValue({});

      await service.propose(DONOR_ID, dto);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.DONATION_CREATE,
        DONOR_ID,
        expect.objectContaining({ wish_id: WISH_ID, type: DonationType.FINANCIAL }),
      );
    });

    it('log DONATION_CONFIRM après la confirmation', async () => {
      const donation = { id: 'don-uuid', donor_id: DONOR_ID, status: DonationStatus.PENDING, wish: { id: WISH_ID, user_id: OWNER_ID } };
      donationRepo.findOne.mockResolvedValue(donation);
      donationRepo.save.mockResolvedValue({ ...donation, status: DonationStatus.COMPLETED });

      await service.confirm(OWNER_ID, 'don-uuid');

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.DONATION_CONFIRM,
        OWNER_ID,
        expect.objectContaining({ donation_id: 'don-uuid', wish_id: WISH_ID }),
      );
    });
  });
});
