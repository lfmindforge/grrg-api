import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to,
      subject,
      html,
    });
    if (error) {
      throw new Error(`Resend: ${error.message}`);
    }
  }
}
