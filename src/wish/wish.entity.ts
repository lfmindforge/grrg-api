import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { DonationType, WishStatus } from './wish.types';

@Entity('wishes')
export class Wish {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  // Relation déclarée pour les jointures futures (US-006, US-007) — non eager
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 100 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ length: 50 })
  category!: string;

  @Column({ type: 'enum', enum: DonationType })
  donation_type!: DonationType;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  amount!: number | null;

  @Column({ default: false })
  is_private!: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  media_urls!: string[];

  @Column({ type: 'enum', enum: WishStatus, default: WishStatus.PENDING })
  status!: WishStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
