import dataSource from '../data-source';
import { User } from '../../user/user.entity';
import { DeepPartial } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const hash = await bcrypt.hash('password123', 10);

  const users: DeepPartial<User>[] = [
    {
      email: 'luc@test.com',
      pseudo: 'luc',
      password_hash: hash,
      birthdate: new Date('1995-01-01'),
      grade: 'etincelle',
    },
    {
      email: 'claw@test.com',
      pseudo: 'claw',
      password_hash: hash,
      birthdate: new Date('1992-06-15'),
      grade: 'etincelle',
    },
  ];

  await userRepo.upsert(users, ['email']);

  console.log('Seed dev terminé.');
  await dataSource.destroy();
}

seed();
