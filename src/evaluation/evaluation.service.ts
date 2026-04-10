import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Evaluation } from '../donation/evaluation.entity';
import { Donation } from '../donation/donation.entity';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import {
  DonationStatus,
  EvaluationBonus,
  EvaluationSatisfaction,
} from '../donation/donation.types';
import { WishStatus } from '../wish/wish.types';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

export function computeGrade(count: number): string {
  if (count >= 200) return 'legende';
  if (count >= 100) return 'mecene';
  if (count >= 50) return 'bienfaiteur';
  if (count >= 20) return 'eclat';
  if (count >= 5) return 'lumiere';
  return 'etincelle';
}

export function computeGlow(
  satisfaction: EvaluationSatisfaction,
  bonus: EvaluationBonus,
  isAnonymous: boolean,
): number {
  const satPoints: Record<EvaluationSatisfaction, number> = {
    [EvaluationSatisfaction.NEUTRAL]: 10,
    [EvaluationSatisfaction.HAPPY]: 20,
    [EvaluationSatisfaction.THRILLED]: 30,
  };
  const bonusPoints: Record<EvaluationBonus, number> = {
    [EvaluationBonus.NONE]: 0,
    [EvaluationBonus.ON_TIME]: 10,
    [EvaluationBonus.WENT_ABOVE_AND_BEYOND]: 10,
  };
  return satPoints[satisfaction] + bonusPoints[bonus] + (isAnonymous ? 40 : 0);
}

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Wish)
    private readonly wishRepo: Repository<Wish>,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async evaluate(
    userId: string,
    donationId: string,
    dto: CreateEvaluationDto,
    proof: Express.Multer.File | undefined,
  ): Promise<Evaluation> {
    const donation = await this.donationRepo.findOne({
      where: { id: donationId },
      relations: { wish: true },
    });
    if (!donation) throw new NotFoundException('Donation introuvable');

    if (donation.wish.user_id !== userId) {
      throw new ForbiddenException(
        'Seul le receveur du souhait peut évaluer un don',
      );
    }

    if (donation.status !== DonationStatus.COMPLETED) {
      throw new BadRequestException(
        'Le don doit être confirmé avant de pouvoir être évalué',
      );
    }

    const existing = await this.evaluationRepo.findOne({
      where: { donation_id: donationId },
    });
    if (existing) throw new ConflictException('Ce don a déjà été évalué');

    if (!proof) {
      throw new BadRequestException('Une preuve photo est obligatoire');
    }

    const bucket = this.config.getOrThrow<string>(
      'SUPABASE_BUCKET_EVALUATIONS_PROOF',
    );
    const ext = proof.originalname.split('.').pop() ?? 'bin';
    const path = `${donationId}/${Date.now()}.${ext}`;
    const proof_url = await this.supabaseStorage.upload(bucket, path, proof);

    const glow_awarded = computeGlow(
      dto.satisfaction,
      dto.bonus ?? EvaluationBonus.NONE,
      donation.is_anonymous,
    );

    const evaluation = await this.evaluationRepo.save(
      this.evaluationRepo.create({
        donation_id: donationId,
        satisfaction: dto.satisfaction,
        bonus: dto.bonus ?? EvaluationBonus.NONE,
        description: dto.description,
        proof_url,
        glow_awarded,
      }),
    );

    const donor = await this.userRepo.findOne({
      where: { id: donation.donor_id },
    });
    const count = await this.evaluationRepo.count({
      where: { donation: { donor_id: donation.donor_id } },
      relations: { donation: true },
    });
    donor!.glow_points += glow_awarded;
    donor!.grade = computeGrade(count);
    await this.userRepo.save(donor!);

    donation.wish.status = WishStatus.FULFILLED;
    await this.wishRepo.save(donation.wish);

    // TODO US-020 — NotificationService.notify(donation.donor_id, { type: 'evaluation_received', glow_awarded })
    return evaluation;
  }
}
