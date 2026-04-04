import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  //jti du JWT refresh - généré coté service (randomUUID())
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  //date avec un timezone évite les erreur de comparaison en cas de fuseaux horaire différent.
  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;
}
