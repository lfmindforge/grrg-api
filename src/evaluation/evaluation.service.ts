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
import { DonationStatus, EvaluationBonus, EvaluationSatisfaction } from '../donation/donation.types';
import { WishStatus } from '../wish/wish.types';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { GlowService } from '../common/glow.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';
import { BadgeService } from '../badge/badge.service';
import { BadgeType } from '../badge/badge.types';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

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
    private readonly glowService: GlowService,
    private readonly notificationService: NotificationService,
    private readonly badgeService: BadgeService,
    private readonly eventService: EventLogService,
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

    if (donation.status === DonationStatus.PENDING) {
      donation.status = DonationStatus.COMPLETED;
      await this.donationRepo.save(donation);
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

    const glow_awarded = this.glowService.computeGlow(
      dto.satisfaction,
      dto.bonus ?? EvaluationBonus.NONE,
      donation.type,
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

    await this.eventService.log(EventType.EVALUATION_CREATE, userId, { donation_id: donationId, satisfaction: dto.satisfaction, glow_awarded, wish_id: donation.wish.id });

    const donor = await this.userRepo.findOne({
      where: { id: donation.donor_id },
    });
    const count = await this.evaluationRepo.count({
      where: { donation: { donor_id: donation.donor_id } },
      relations: { donation: true },
    });

    // Capturer le grade avant mise à jour pour détecter une montée de grade
    const previousGrade = donor!.grade;
    const newGrade = this.glowService.computeGrade(count);
    donor!.glow_points += glow_awarded;
    donor!.grade = newGrade;
    await this.userRepo.save(donor!);

    donation.wish.status = WishStatus.FULFILLED;
    await this.wishRepo.save(donation.wish);

    const wishOwner = await this.userRepo.findOne({ where: { id: donation.wish.user_id } });

    await this.notificationService.notify(donation.donor_id, NotificationType.EVALUATION_RECEIVED, {
      glow_awarded,
      recipient_pseudo: wishOwner!.pseudo,
      wish_id: donation.wish.id,
    });

    if (newGrade !== previousGrade) {
      await this.notificationService.notify(donation.donor_id, NotificationType.GRADE_UP, {
        grade: newGrade,
        previous_grade: previousGrade,
      });
    }

    if (
      evaluation.bonus === EvaluationBonus.WENT_ABOVE_AND_BEYOND &&
      evaluation.satisfaction === EvaluationSatisfaction.THRILLED
    ) {
      await this.badgeService.award(donation.donor_id, BadgeType.MOST_IMPROBABLE_WISH);
    }

    return evaluation;
  }
}
