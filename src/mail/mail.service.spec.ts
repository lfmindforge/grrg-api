import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockSend = jest.fn().mockResolvedValue({ id: 'email-id' });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('MailService', () => {
  let service: MailService;
  const mockConfig = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test_key';
      if (key === 'EMAIL_FROM') return 'noreply@grrg.app';
      throw new Error(`Unknown key: ${key}`);
    }),
  };

  beforeEach(() => {
    mockSend.mockClear();
    service = new MailService(mockConfig as unknown as ConfigService);
  });

  it('appelle resend.emails.send avec les bons paramètres', async () => {
    await service.sendMail('user@example.com', 'Sujet test', '<p>HTML</p>');

    expect(mockSend).toHaveBeenCalledWith({
      from: 'noreply@grrg.app',
      to: 'user@example.com',
      subject: 'Sujet test',
      html: '<p>HTML</p>',
    });
  });

  it('propage les erreurs Resend', async () => {
    mockSend.mockRejectedValueOnce(new Error('Resend error'));
    await expect(
      service.sendMail('user@example.com', 'Sujet', '<p>HTML</p>'),
    ).rejects.toThrow('Resend error');
  });
});
