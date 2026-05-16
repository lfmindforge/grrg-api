import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donation } from './donation.entity';
import { Wish } from '../wish/wish.entity';
import { DonationType, WishStatus } from '../wish/wish.types';
import { DonationStatus } from './donation.types';
import { CreateDonationDto } from './dto/create-donation.dto';

@Injectable()
export class DonationService {
  constructor(
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Wish)
    private readonly wishRepo: Repository<Wish>,
  ) {}

  async propose(donorId: string, dto: CreateDonationDto): Promise<Donation> {
    const wish = await this.wishRepo.findOne({ where: { id: dto.wish_id } });
    if (!wish) throw new NotFoundException('Souhait introuvable');
    if (wish.status !== WishStatus.PENDING) {
      throw new BadRequestException('Ce souhait ne peut plus recevoir de dons');
    }
    if (wish.user_id === donorId) {
      throw new ForbiddenException(
        'Impossible de faire un don sur son propre souhait',
      );
    }

    const donation = this.donationRepo.create({
      wish_id: dto.wish_id,
      donor_id: donorId,
      type: dto.type,
      amount: dto.type === DonationType.FINANCIAL ? (dto.amount ?? null) : null,
      nature_description:
        dto.type !== DonationType.FINANCIAL
          ? (dto.nature_description ?? null)
          : null,
      is_anonymous: dto.is_anonymous ?? false,
      status: DonationStatus.PENDING,
    });

    const saved = await this.donationRepo.save(donation);
    wish.status = WishStatus.IN_PROGRESS;
    await this.wishRepo.save(wish);

    // TODO US-020 — NotificationService.notify(wish.user_id, { type: 'donation_proposed', donation_id: saved.id })
    return saved;
  }

  async confirm(userId: string, donationId: string): Promise<Donation> {
    const donation = await this.donationRepo.findOne({
      where: { id: donationId },
      relations: { wish: true },
    });
    if (!donation) throw new NotFoundException('Donation introuvable');

    if (donation.wish.user_id !== userId) {
      throw new ForbiddenException(
        'Seul le receveur du souhait peut confirmer un don',
      );
    }

    if (donation.status !== DonationStatus.PENDING) {
      throw new BadRequestException('Ce don a déjà été confirmé');
    }

    donation.status = DonationStatus.COMPLETED;
    return this.donationRepo.save(donation);
  }

  async findMyDonations(userId: string): Promise<Donation[]> {
    return this.donationRepo.find({
      where: { donor_id: userId },
      relations: { wish: true, evaluation: true },
      order: { created_at: 'DESC' },
    });
  }

  async findReceived(userId: string): Promise<Donation[]> {
    return this.donationRepo
      .createQueryBuilder('donation')
      .innerJoinAndSelect('donation.wish', 'wish')
      .leftJoin('donation.evaluation', 'evaluation')
      .where('wish.user_id = :userId', { userId })
      .andWhere('evaluation.id IS NULL')
      .getMany();
  }
}
