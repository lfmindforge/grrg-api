import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserSetting } from './user-setting.entity';
import { UserSettingsService } from './user-settings.service';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  upsert: jest.fn(),
};

describe('UserSettingsService', () => {
  let service: UserSettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UserSettingsService,
        { provide: getRepositoryToken(UserSetting), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(UserSettingsService);
  });

  describe('get', () => {
    it('retourne null si aucune ligne', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      expect(await service.get('u1', 'notif.donation_received')).toBeNull();
    });

    it('retourne la valeur si ligne existante', async () => {
      mockRepo.findOne.mockResolvedValue({ value: false });
      expect(await service.get('u1', 'notif.donation_received')).toBe(false);
    });
  });

  describe('set', () => {
    it('upsert avec la bonne clé et valeur', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);
      await service.set('u1', 'notif.donation_received', false);
      expect(mockRepo.upsert).toHaveBeenCalledWith(
        { user_id: 'u1', key: 'notif.donation_received', value: false },
        { conflictPaths: ['user_id', 'key'] },
      );
    });
  });

  describe('getByPrefix', () => {
    it('retourne les entrées correspondant au préfixe sous forme de Record', async () => {
      mockRepo.find.mockResolvedValue([
        { key: 'notif.donation_received', value: false },
        { key: 'notif.evaluation_received', value: true },
      ]);
      const result = await service.getByPrefix('u1', 'notif.');
      expect(result).toEqual({
        'notif.donation_received': false,
        'notif.evaluation_received': true,
      });
    });

    it('retourne un objet vide si aucune entrée', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.getByPrefix('u1', 'notif.');
      expect(result).toEqual({});
    });
  });

  describe('isNotifEmailEnabled', () => {
    it('retourne true si aucune ligne (opt-out, défaut activé)', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      expect(await service.isNotifEmailEnabled('u1', 'donation_received')).toBe(true);
    });

    it('retourne false si valeur false en base', async () => {
      mockRepo.findOne.mockResolvedValue({ value: false });
      expect(await service.isNotifEmailEnabled('u1', 'donation_received')).toBe(false);
    });

    it('retourne true si valeur true en base', async () => {
      mockRepo.findOne.mockResolvedValue({ value: true });
      expect(await service.isNotifEmailEnabled('u1', 'donation_received')).toBe(true);
    });
  });
});
