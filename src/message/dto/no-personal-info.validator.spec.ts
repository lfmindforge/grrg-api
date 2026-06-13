import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

function buildDto(content: string): SendMessageDto {
  const dto = new SendMessageDto();
  dto.recipient_id = '00000000-0000-0000-0000-000000000001';
  dto.content = content;
  return dto;
}

describe('NoPersonalInfo validator', () => {
  it('accepte un message normal', async () => {
    const errors = await validate(buildDto('Salut, comment tu vas ?'));
    expect(errors.filter(e => e.property === 'content')).toHaveLength(0);
  });

  it('rejette un message contenant un email', async () => {
    const errors = await validate(buildDto('Contacte-moi sur jean@example.com'));
    const contentErrors = errors.filter(e => e.property === 'content');
    expect(contentErrors.length).toBeGreaterThan(0);
    expect(Object.values(contentErrors[0].constraints ?? {})).toContain(
      "Le message ne peut pas contenir d'adresse email ou de numéro de téléphone",
    );
  });

  it('rejette un message contenant un numéro de téléphone', async () => {
    const errors = await validate(buildDto('Appelle-moi au +32 478 12 34 56'));
    const contentErrors = errors.filter(e => e.property === 'content');
    expect(contentErrors.length).toBeGreaterThan(0);
  });

  it('rejette un numéro de téléphone sans indicatif', async () => {
    const errors = await validate(buildDto('Mon numéro : 0478123456'));
    const contentErrors = errors.filter(e => e.property === 'content');
    expect(contentErrors.length).toBeGreaterThan(0);
  });

  it('accepte un message avec des chiffres non suspects', async () => {
    const errors = await validate(buildDto("J'ai commandé 3 articles, livraison dans 2 jours"));
    expect(errors.filter(e => e.property === 'content')).toHaveLength(0);
  });
});
