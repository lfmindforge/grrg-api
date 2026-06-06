import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  badge_type!: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  period!: string | null;

  @CreateDateColumn()
  earned_at!: Date;
}
