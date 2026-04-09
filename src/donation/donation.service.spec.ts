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
import { DonationType, WishStatus } from '../wish/wish.types';
import { DonationStatus } from './donation.types';
import { CreateDonationDto } from './dto/create-donation.dto';

describe('DonationService', () => {
  let service: DonationService;
  let donationRepo: { create: jest.Mock; save: jest.Mock };
  let wishRepo: { findOne: jest.Mock };

  const DONOR_ID = 'donor-uuid';
  const OWNER_ID = 'owner-uuid';
  const WISH_ID = 'wish-uuid';

  const mockWish = {
    id: WISH_ID,
    user_id: OWNER_ID,
    status: WishStatus.PENDING,
  } as Wish;

  beforeEach(async () => {
    donationRepo = { create: jest.fn(), save: jest.fn() };
    wishRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationService,
        { provide: getRepositoryToken(Donation), useValue: donationRepo },
        { provide: getRepositoryToken(Wish), useValue: wishRepo },
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
        is_anonymous: false,
      };
      const created = {
        id: 'don-uuid',
        ...dto,
        donor_id: DONOR_ID,
        status: DonationStatus.PENDING,
      };
      wishRepo.findOne.mockResolvedValue(mockWish);
      donationRepo.create.mockReturnValue(created);
      donationRepo.save.mockResolvedValue(created);

      const result = await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wish_id: WISH_ID,
          donor_id: DONOR_ID,
          type: DonationType.FINANCIAL,
          amount: 50,
          nature_description: null,
          is_anonymous: false,
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
      wishRepo.findOne.mockResolvedValue(mockWish);
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 10,
      };

      await expect(service.propose(OWNER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('enregistre is_anonymous=true quand demandé', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.FINANCIAL,
        amount: 30,
        is_anonymous: true,
      };
      wishRepo.findOne.mockResolvedValue(mockWish);
      donationRepo.create.mockReturnValue({ ...dto, donor_id: DONOR_ID });
      donationRepo.save.mockResolvedValue({
        ...dto,
        donor_id: DONOR_ID,
        status: DonationStatus.PENDING,
      });

      await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_anonymous: true }),
      );
    });

    it('met amount à null pour type delivery', async () => {
      const dto: CreateDonationDto = {
        wish_id: WISH_ID,
        type: DonationType.DELIVERY,
        nature_description: 'Un vélo',
      };
      wishRepo.findOne.mockResolvedValue(mockWish);
      donationRepo.create.mockReturnValue({ ...dto, donor_id: DONOR_ID });
      donationRepo.save.mockResolvedValue({ ...dto, donor_id: DONOR_ID });

      await service.propose(DONOR_ID, dto);

      expect(donationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: null,
          nature_description: 'Un vélo',
        }),
      );
    });
  });
});
