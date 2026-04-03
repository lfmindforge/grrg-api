import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findByPseudo(pseudo: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { pseudo } });
  }

  create(
    data: Pick<User, 'email' | 'password_hash' | 'pseudo' | 'birthdate'>,
  ): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }
}
