import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_a_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_a_id' })
  user_a!: User;

  @Column({ type: 'uuid' })
  user_b_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_b_id' })
  user_b!: User;

  @CreateDateColumn()
  created_at!: Date;

  @DeleteDateColumn()
  deleted_at?: Date;
}
