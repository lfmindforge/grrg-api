import dataSource from '../data-source';
import { User } from '../../user/user.entity';
import { DeepPartial } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const hash = await bcrypt.hash('password123', 10);

  const adminHash = await bcrypt.hash('admin1234', 10);

  const users: DeepPartial<User>[] = [
    {
      email: 'User_1@test.com',
      pseudo: 'User_1',
      password_hash: hash,
      birthdate: new Date('1995-01-01'),
      grade: 'etincelle',
    },
    {
      email: 'User_2@test.com',
      pseudo: 'User_2',
      password_hash: hash,
      birthdate: new Date('1992-06-15'),
      grade: 'etincelle',
    },
    {
      email: 'admin@grrg.dev',
      pseudo: 'admin',
      password_hash: adminHash,
      birthdate: new Date('1990-01-01'),
      grade: 'legende',
      role: 'admin',
    },
  ];

  await userRepo.upsert(users, ['email']);

  const categories = [
    'Art',
    'Beauté & Bien-être',
    'Cuisine & Gastronomie',
    'High-Tech',
    'Jeux & Loisirs',
    'Livres & Culture',
    'Maison & Déco',
    'Mode & Accessoires',
    'Musique',
    'Sport & Fitness',
    'Voyage & Aventure',
    'Autre',
  ];

  for (const name of categories) {
    await dataSource.query(
      `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name],
    );
  }

  console.log('Seed dev terminé.');
  await dataSource.destroy();
}

seed();
