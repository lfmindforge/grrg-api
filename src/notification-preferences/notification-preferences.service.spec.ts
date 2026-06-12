import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreference } from './notification-preference.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  upsert: jest.fn(),
};

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: getRepositoryToken(NotificationPreference), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(NotificationPreferencesService);
  });

  describe('getPreferences', () => {
    it('retourne les deux types à true si aucune ligne en base', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.getPreferences('user-1');
      expect(result).toEqual([
        { event_type: 'donation_received', email_enabled: true },
        { event_type: 'evaluation_received', email_enabled: true },
      ]);
    });

    it('retourne false pour donation_received si désactivé en base', async () => {
      mockRepo.find.mockResolvedValue([
        { event_type: 'donation_received', email_enabled: false },
      ]);
      const result = await service.getPreferences('user-1');
      expect(result).toEqual([
        { event_type: 'donation_received', email_enabled: false },
        { event_type: 'evaluation_received', email_enabled: true },
      ]);
    });

    it('retourne les deux depuis la DB si les deux existent', async () => {
      mockRepo.find.mockResolvedValue([
        { event_type: 'donation_received', email_enabled: false },
        { event_type: 'evaluation_received', email_enabled: false },
      ]);
      const result = await service.getPreferences('user-1');
      expect(result).toEqual([
        { event_type: 'donation_received', email_enabled: false },
        { event_type: 'evaluation_received', email_enabled: false },
      ]);
    });
  });

  describe('updatePreferences', () => {
    it('upsert une seule entrée si un seul champ fourni', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);
      await service.updatePreferences('user-1', { donation_received: false });
      expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
      expect(mockRepo.upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', event_type: 'donation_received', email_enabled: false },
        { conflictPaths: ['user_id', 'event_type'] },
      );
    });

    it('upsert deux entrées si les deux champs fournis', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);
      await service.updatePreferences('user-1', { donation_received: true, evaluation_received: false });
      expect(mockRepo.upsert).toHaveBeenCalledTimes(2);
    });

    it('ne fait rien si DTO vide', async () => {
      await service.updatePreferences('user-1', {});
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('isEmailEnabled', () => {
    it('retourne true si aucune ligne en base', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      expect(await service.isEmailEnabled('user-1', 'donation_received')).toBe(true);
    });

    it('retourne false si désactivé en base', async () => {
      mockRepo.findOne.mockResolvedValue({ email_enabled: false });
      expect(await service.isEmailEnabled('user-1', 'donation_received')).toBe(false);
    });

    it('retourne true si activé en base', async () => {
      mockRepo.findOne.mockResolvedValue({ email_enabled: true });
      expect(await service.isEmailEnabled('user-1', 'donation_received')).toBe(true);
    });
  });
});
