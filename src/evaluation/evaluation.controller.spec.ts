import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import {
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../donation/donation.types';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

describe('EvaluationController', () => {
  let controller: EvaluationController;
  let service: { evaluate: jest.Mock };

  const RECEIVER_ID = 'receiver-uuid';
  const DONATION_ID = 'donation-uuid';

  beforeEach(async () => {
    service = { evaluate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationController],
      providers: [{ provide: EvaluationService, useValue: service }],
    }).compile();

    controller = module.get<EvaluationController>(EvaluationController);
  });

  describe('POST /:donationId', () => {
    it('appelle service.evaluate avec userId, donationId, dto et le fichier', async () => {
      const dto: CreateEvaluationDto = {
        satisfaction: EvaluationSatisfaction.HAPPY,
        description: 'Reçu en parfait état',
        bonus: EvaluationBonus.ON_TIME,
      };
      const mockFile = { originalname: 'proof.jpg' } as Express.Multer.File;
      const mockReq = { user: { id: RECEIVER_ID } } as any;
      const expected = { id: 'eval-uuid', glow_awarded: 30 };
      service.evaluate.mockResolvedValue(expected);

      const result = await controller.evaluate(
        mockReq,
        DONATION_ID,
        dto,
        mockFile,
      );

      expect(service.evaluate).toHaveBeenCalledWith(
        RECEIVER_ID,
        DONATION_ID,
        dto,
        mockFile,
      );
      expect(result).toEqual(expected);
    });
  });
});
