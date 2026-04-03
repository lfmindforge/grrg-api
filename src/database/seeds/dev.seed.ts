import dataSource from '../data-source';
import { User } from '../../user/user.entity';
import { DeepPartial } from 'typeorm';

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const users: DeepPartial<User>[] = [
    {
      email: 'luc@test.com',
      pseudo: 'luc',
      password_hash: null,
      birthdate: new Date('1995-01-01'),
      grade: 'etincelle',
    },
    {
      email: 'claw@test.com',
      pseudo: 'claw',
      password_hash: null,
      birthdate: new Date('1992-06-15'),
      grade: 'etincelle',
    },
  ];

  await userRepo.save(users);

  console.log('Seed dev terminé.');
  await dataSource.destroy();
}

seed();
