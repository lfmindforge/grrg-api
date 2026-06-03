import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('follows')
export class Follow {
  @PrimaryColumn({ type: 'uuid' })
  follower_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  followed_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'follower_id' })
  follower!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'followed_id' })
  followed!: User;

  @CreateDateColumn()
  created_at!: Date;
}
