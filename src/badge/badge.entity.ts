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

  @Column({ type: 'int', default: 1 })
  count!: number;

  @CreateDateColumn()
  earned_at!: Date;
}
