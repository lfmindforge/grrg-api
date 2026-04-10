import { Test, TestingModule } from '@nestjs/testing';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationType } from '../wish/wish.types';
import { DonationStatus } from './donation.types';

describe('DonationController', () => {
  let controller: DonationController;
  let service: {
    propose: jest.Mock;
    confirm: jest.Mock;
    findMyDonations: jest.Mock;
  };

  const DONOR_ID = 'donor-uuid';

  beforeEach(async () => {
    service = {
      propose: jest.fn(),
      confirm: jest.fn(),
      findMyDonations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonationController],
      providers: [{ provide: DonationService, useValue: service }],
    }).compile();

    controller = module.get<DonationController>(DonationController);
  });

  describe('POST /donations', () => {
    it('appelle service.propose avec le donor_id et le dto', async () => {
      const dto: CreateDonationDto = {
        wish_id: 'wish-uuid',
        type: DonationType.FINANCIAL,
        amount: 50,
      };
      const mockReq = { user: { id: DONOR_ID } } as any;
      const expected = { id: 'don-uuid', status: DonationStatus.PENDING };
      service.propose.mockResolvedValue(expected);

      const result = await controller.propose(mockReq, dto);

      expect(service.propose).toHaveBeenCalledWith(DONOR_ID, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('PATCH /donations/:id/confirm', () => {
    it('appelle service.confirm avec userId et donationId', async () => {
      const mockReq = { user: { id: DONOR_ID } } as any;
      const expected = { id: 'don-uuid', status: DonationStatus.COMPLETED };
      service.confirm.mockResolvedValue(expected);

      const result = await controller.confirm(mockReq, 'don-uuid');

      expect(service.confirm).toHaveBeenCalledWith(DONOR_ID, 'don-uuid');
      expect(result).toEqual(expected);
    });
  });

  describe('GET /donations/me', () => {
    it('appelle service.findMyDonations avec userId et retourne la liste', async () => {
      const mockReq = { user: { id: DONOR_ID } } as any;
      const expected = [{ id: 'don-uuid', status: DonationStatus.COMPLETED }];
      service.findMyDonations.mockResolvedValue(expected);

      const result = await controller.findMyDonations(mockReq);

      expect(service.findMyDonations).toHaveBeenCalledWith(DONOR_ID);
      expect(result).toEqual(expected);
    });
  });
});
