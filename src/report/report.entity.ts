import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user/user.entity';

export enum ReportTargetType {
  WISH    = 'wish',
  COMMENT = 'comment',
  MESSAGE = 'message',
}

export enum ReportReason {
  INAPPROPRIATE = 'inappropriate',
  SPAM          = 'spam',
  HARASSMENT    = 'harassment',
  MISLEADING    = 'misleading',
  OTHER         = 'other',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporter_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ type: 'enum', enum: ReportTargetType })
  target_type!: ReportTargetType;

  @Column({ type: 'uuid' })
  target_id!: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason!: ReportReason;

  @Column({ type: 'varchar', length: 300, nullable: true, default: null })
  details!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
