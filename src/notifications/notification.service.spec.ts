import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationType } from './notification.types';
import { MailService } from '../mail/mail.service';
import { UserSettingsService } from '../user-settings/user-settings.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockMailService: jest.Mocked<Pick<MailService, 'sendMail'>> = {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  const mockUserSettingsService: jest.Mocked<Pick<UserSettingsService, 'isNotifEmailEnabled'>> = {
    isNotifEmailEnabled: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSettingsService.isNotifEmailEnabled.mockResolvedValue(true);
    service = new NotificationService(
      mockRepo as any,
      mockUserRepo as any,
      mockMailService as any,
      mockUserSettingsService as any,
    );
  });

  it('insère une notification en base et la retourne', async () => {
    const payload = { glowAwarded: 20, currentGrade: 'etincelle' };
    const created = {
      id: 'notif-uuid',
      user_id: 'user-1',
      type: 'grade_up',
      payload,
      is_read: false,
      created_at: new Date(),
    };
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    const result = await service.create('user-1', 'grade_up', payload);

    expect(mockRepo.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'grade_up',
      payload,
    });
    expect(mockRepo.save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });

  it('notify() crée la notif et la pousse au client SSE connecté', async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'grade_up', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'user@example.com' });

    const subject = service.registerClient('u1');
    const received: unknown[] = [];
    subject.subscribe(e => received.push(e));

    await service.notify('u1', NotificationType.GRADE_UP, { grade: 'lumiere', previous_grade: 'etincelle' });

    expect(mockRepo.save).toHaveBeenCalled();
    expect(received).toHaveLength(1);
  });

  it('notify() envoie un email quand un template existe pour le type', async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'evaluation_received', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'donor@example.com' });

    await service.notify('u1', NotificationType.EVALUATION_RECEIVED, {
      glow_awarded: 30,
      recipient_pseudo: 'Bob',
      wish_id: 'w1',
    });

    expect(mockMailService.sendMail).toHaveBeenCalledWith(
      'donor@example.com',
      expect.stringContaining('évalué'),
      expect.stringContaining('30'),
    );
  });

  it("notify() n'envoie pas d'email quand il n'y a pas de template pour le type", async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'comment_received', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'user@example.com' });

    await service.notify('u1', NotificationType.COMMENT_RECEIVED, { comment: 'bravo' });

    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it("notify() ne bloque pas si l'email échoue", async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'grade_up', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'user@example.com' });
    mockMailService.sendMail.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      service.notify('u1', NotificationType.GRADE_UP, { grade: 'lumiere', previous_grade: 'etincelle' }),
    ).resolves.not.toThrow();
  });

  it("notify() n'envoie pas d'email si l'utilisateur est introuvable", async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'grade_up', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue(null);

    await service.notify('u1', NotificationType.GRADE_UP, { grade: 'lumiere', previous_grade: 'etincelle' });

    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it('findByUser() retourne les 30 dernières notifs et unread_count', async () => {
    const notifs = [
      { id: 'n1', is_read: false },
      { id: 'n2', is_read: true },
    ];
    mockRepo.find.mockResolvedValue(notifs);

    const result = await service.findByUser('u1');

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      order: { created_at: 'DESC' },
      take: 30,
    });
    expect(result.unread_count).toBe(1);
    expect(result.data).toHaveLength(2);
  });

  it('markRead() appelle update avec user_id + notif id', async () => {
    mockRepo.update.mockResolvedValue({ affected: 1 });
    await service.markRead('u1', 'n1');
    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'n1', user_id: 'u1' },
      { is_read: true },
    );
  });

  it('markAllRead() passe toutes les notifs non lues à is_read=true', async () => {
    mockRepo.update.mockResolvedValue({ affected: 3 });
    await service.markAllRead('u1');
    expect(mockRepo.update).toHaveBeenCalledWith(
      { user_id: 'u1', is_read: false },
      { is_read: true },
    );
  });

  it("notify() ne pas envoyer de mail si isNotifEmailEnabled retourne false", async () => {
    mockUserSettingsService.isNotifEmailEnabled.mockResolvedValue(false);
    const notif = { id: 'n1', user_id: 'u1', type: 'donation_received', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'test@example.com' });

    await service.notify('u1', NotificationType.DONATION_RECEIVED, {
      wish_title: 'Vélo',
      donor_pseudo: 'bob',
    });

    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it("notify() envoie le mail si isNotifEmailEnabled retourne true", async () => {
    mockUserSettingsService.isNotifEmailEnabled.mockResolvedValue(true);
    const notif = { id: 'n1', user_id: 'u1', type: 'donation_received', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);
    mockUserRepo.findOne.mockResolvedValue({ email: 'test@example.com' });

    await service.notify('u1', NotificationType.DONATION_RECEIVED, {
      wish_title: 'Vélo',
      donor_pseudo: 'bob',
    });

    expect(mockMailService.sendMail).toHaveBeenCalled();
  });

  it('removeClient() complète le subject et le retire du registre', () => {
    const subject = service.registerClient('u1');
    let completed = false;
    subject.subscribe({ complete: () => { completed = true; } });
    service.removeClient('u1', subject);
    expect(completed).toBe(true);
  });
});
