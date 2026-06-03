import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  wish_id!: string;

  @ManyToOne(() => Wish)
  @JoinColumn({ name: 'wish_id' })
  wish!: Wish;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: false })
  is_reported!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
