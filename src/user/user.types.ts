export type CreateUserData = {
  email: string;
  password_hash: string | null;
  pseudo: string;
  birthdate?: Date | null;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_id?: string | null;
};
