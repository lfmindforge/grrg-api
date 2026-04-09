import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Donation } from './donation.entity';
import { EvaluationBonus, EvaluationSatisfaction } from './donation.types';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  donation_id!: string;

  // OneToOne — contrainte UNIQUE donation_id en base
  @OneToOne(() => Donation)
  @JoinColumn({ name: 'donation_id' })
  donation!: Donation;

  @Column({ type: 'enum', enum: EvaluationSatisfaction })
  satisfaction!: EvaluationSatisfaction;

  @Column({
    type: 'enum',
    enum: EvaluationBonus,
    default: EvaluationBonus.NONE,
  })
  bonus!: EvaluationBonus;

  @Column({ type: 'int', default: 0 })
  glow_awarded!: number;

  @Column({ type: 'text', nullable: true })
  proof_url!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
