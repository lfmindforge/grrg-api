export class UserExportDto {
  profile!: {
    id: string;
    email: string;
    pseudo: string;
    birthdate: Date | null;
    grade: string;
    glow_points: number;
    created_at: Date;
  };
  wishes!: object[];
  donations_made!: object[];
  donations_received!: object[];
}
