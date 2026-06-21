import { buildEmailTemplate } from './mail.templates';
import { NotificationType } from '../notifications/notification.types';

describe('buildEmailTemplate', () => {
  it('retourne un template pour donation_received', () => {
    const result = buildEmailTemplate(NotificationType.DONATION_RECEIVED, {
      donor_pseudo: 'Alice',
      wish_title: 'Un vélo',
      wish_id: 'w1',
      donation_id: 'd1',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('don');
    expect(result!.html).toContain('Un vélo');
    expect(result!.html).toContain('Alice');
  });

  it('retourne un template pour evaluation_received', () => {
    const result = buildEmailTemplate(NotificationType.EVALUATION_RECEIVED, {
      glow_awarded: 30,
      recipient_pseudo: 'Bob',
      wish_id: 'w1',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('évalué');
    expect(result!.html).toContain('30');
    expect(result!.html).toContain('Bob');
  });

  it('retourne un template pour grade_up', () => {
    const result = buildEmailTemplate(NotificationType.GRADE_UP, {
      grade: 'lumiere',
      previous_grade: 'etincelle',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('grade');
    expect(result!.html).toContain('lumiere');
    expect(result!.html).toContain('etincelle');
  });

  it('retourne un template pour wish_expired', () => {
    const result = buildEmailTemplate(NotificationType.WISH_EXPIRED, {
      wish_title: 'Un vélo électrique',
      wish_id: 'w1',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('expiré');
    expect(result!.html).toContain('Un vélo électrique');
  });

  it('retourne null pour un type sans template', () => {
    const result = buildEmailTemplate(NotificationType.COMMENT_RECEIVED, {});
    expect(result).toBeNull();
  });
});
