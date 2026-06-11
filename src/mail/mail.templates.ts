import { NotificationType } from '../notifications/notification.types';

export type MailTemplate = { subject: string; html: string };

export function buildEmailTemplate(
  type: NotificationType,
  payload: Record<string, unknown>,
): MailTemplate | null {
  switch (type) {
    case NotificationType.DONATION_RECEIVED:
      return donationReceived(payload);
    case NotificationType.EVALUATION_RECEIVED:
      return evaluationReceived(payload);
    case NotificationType.GRADE_UP:
      return gradeUp(payload);
    default:
      return null;
  }
}

function donationReceived(payload: Record<string, unknown>): MailTemplate {
  const isAnonymous = payload['is_anonymous'] as boolean;
  const donorName = isAnonymous ? "Quelqu'un" : (payload['donor_pseudo'] as string);
  const wishTitle = payload['wish_title'] as string;

  return {
    subject: `Gift Rumble — Vous avez reçu un don sur votre souhait`,
    html: `
      <h2>Vous avez reçu un don !</h2>
      <p><strong>${donorName}</strong> souhaite exaucer votre souhait <em>«${wishTitle}»</em>.</p>
      <p>Connectez-vous sur la plateforme pour confirmer et évaluer ce don.</p>
    `,
  };
}

function evaluationReceived(payload: Record<string, unknown>): MailTemplate {
  const glowAwarded = payload['glow_awarded'] as number;
  const recipientPseudo = payload['recipient_pseudo'] as string;

  return {
    subject: `Gift Rumble — Votre don a été évalué (+${glowAwarded} Glow)`,
    html: `
      <h2>Votre don a été évalué !</h2>
      <p>Vous avez reçu <strong>${glowAwarded} points Glow</strong> suite à l'évaluation de <strong>${recipientPseudo}</strong>.</p>
      <p>Consultez votre profil pour voir votre progression.</p>
    `,
  };
}

function gradeUp(payload: Record<string, unknown>): MailTemplate {
  const grade = payload['grade'] as string;
  const previousGrade = payload['previous_grade'] as string;

  return {
    subject: `Gift Rumble — Nouveau grade : ${grade} !`,
    html: `
      <h2>Félicitations, vous avez monté de grade !</h2>
      <p>Vous passez de <strong>${previousGrade}</strong> à <strong>${grade}</strong>.</p>
      <p>Continuez à donner pour progresser encore plus.</p>
    `,
  };
}
