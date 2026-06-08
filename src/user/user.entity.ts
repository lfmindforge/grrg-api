import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  password_hash!: string | null;

  @Column({ unique: true, length: 50 })
  pseudo!: string;

  @Column({ type: 'date', nullable: true })
  birthdate!: Date | null;

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  oauth_provider!: string | null;

  @Column({ type: 'varchar', nullable: true })
  oauth_id!: string | null;

  @Column({ default: 0 })
  glow_points!: number;

  @Column({ length: 30, default: 'etincelle' })
  grade!: string;

  @Column({ type: 'varchar', length: 10, default: 'user' })
  role!: 'user' | 'admin';

  @CreateDateColumn()
  created_at!: Date;

  @DeleteDateColumn()
  deleted_at!: Date | null;
}
// "!" promet une valeur car c'est au runtime que l'hydratation se fait par TypeOrm et non par le constructeur.
