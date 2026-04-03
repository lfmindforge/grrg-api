import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.userService.findByEmail(dto.email);
    if (existingEmail) throw new ConflictException('Email already in use');

    const existingPseudo = await this.userService.findByPseudo(dto.pseudo);
    if (existingPseudo) throw new ConflictException('Pseudo already in use');

    // Verification de l'age légal à la date du jour (18 ans)
    const birthdate = new Date(dto.birthdate);
    const today = new Date();
    const age =
      today.getFullYear() -
      birthdate.getFullYear() -
      (today <
      new Date(today.getFullYear(), birthdate.getMonth(), birthdate.getDate())
        ? 1
        : 0);
    if (age < 18)
      throw new UnprocessableEntityException(
        'You must be at least 18 years old',
      );

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.create({
      email: dto.email,
      password_hash,
      pseudo: dto.pseudo,
      birthdate,
    });

    // Exclure le mot de passe de la réponse et copie le reste
    const { password_hash: _, ...publicUser } = user;
    return publicUser;
  }
}
