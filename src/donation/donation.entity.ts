import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { Evaluation } from './evaluation.entity';
import { DonationType } from '../wish/wish.types';
import { DonationStatus } from './donation.types';

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  wish_id!: string;

  @ManyToOne(() => Wish)
  @JoinColumn({ name: 'wish_id' })
  wish!: Wish;

  @Column({ type: 'uuid' })
  donor_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'donor_id' })
  donor!: User;

  @Column({ type: 'enum', enum: DonationType })
  type!: DonationType;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  amount!: number | null;

  @Column({ type: 'text', nullable: true })
  nature_description!: string | null;

  @Column({
    type: 'enum',
    enum: DonationStatus,
    default: DonationStatus.PENDING,
  })
  status!: DonationStatus;

  @CreateDateColumn()
  created_at!: Date;

  @DeleteDateColumn()
  deleted_at!: Date | null;

  // Relation inverse — chargeable via relations: { evaluation: true }
  @OneToOne(() => Evaluation, (evaluation) => evaluation.donation, {
    nullable: true,
  })
  evaluation!: Evaluation | null;
}
