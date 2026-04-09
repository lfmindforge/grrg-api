import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  const mockUserService = {
    getProfile: jest.fn(),
    updateMe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('getProfile()', () => {
    it("délègue à UserService.getProfile avec l'id", async () => {
      const profile = { id: 'user-id', pseudo: 'alice' };
      mockUserService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('user-id');

      expect(mockUserService.getProfile).toHaveBeenCalledWith('user-id');
      expect(result).toBe(profile);
    });

    it('ParseUUIDPipe rejette un id non-UUID', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(
        pipe.transform('not-a-uuid', { type: 'param' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMe()', () => {
    it('délègue à UserService.updateMe avec userId, dto et file', async () => {
      const req = { user: { id: 'user-id' } };
      const dto = { pseudo: 'nouveau' };
      const file = { originalname: 'avatar.jpg' } as Express.Multer.File;
      const profile = { id: 'user-id', pseudo: 'nouveau' };
      mockUserService.updateMe.mockResolvedValue(profile);

      const result = await controller.updateMe(req, dto, file);

      expect(mockUserService.updateMe).toHaveBeenCalledWith(
        'user-id',
        dto,
        file,
      );
      expect(result).toBe(profile);
    });

    it('sans fichier → passe undefined à UserService', async () => {
      const req = { user: { id: 'user-id' } };
      const dto = {};
      mockUserService.updateMe.mockResolvedValue({ id: 'user-id' });

      await controller.updateMe(req, dto, undefined);

      expect(mockUserService.updateMe).toHaveBeenCalledWith(
        'user-id',
        dto,
        undefined,
      );
    });
  });
});
