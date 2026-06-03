import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';

@Entity('reactions')
@Unique(['user_id', 'wish_id'])
export class Reaction {
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

  @Column({ type: 'varchar', length: 10 })
  emoji!: string;

  @CreateDateColumn()
  created_at!: Date;
}
