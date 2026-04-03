# Auth Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter `POST /auth/register` avec validation email, pseudo unique, âge 18+, hash bcrypt et retour des données publiques du user créé.

**Architecture:** `UserModule` expose `UserService` (repository TypeORM) réutilisable par tous les modules. `AuthModule` importe `UserModule` et orchestre la logique de register dans `AuthService`.

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL, class-validator, class-transformer, bcrypt, Jest

---

## Fichiers concernés

| Action   | Fichier                                                |
| -------- | ------------------------------------------------------ |
| Modifier | `src/user/user.entity.ts`                              |
| Modifier | `src/database/migrations/1775216576270-CreateUsers.ts` |
| Modifier | `src/main.ts`                                          |
| Modifier | `src/app.module.ts`                                    |
| Créer    | `src/user/user.service.ts`                             |
| Créer    | `src/user/user.module.ts`                              |
| Créer    | `src/user/user.service.spec.ts`                        |
| Créer    | `src/auth/dto/register.dto.ts`                         |
| Créer    | `src/auth/auth.service.ts`                             |
| Créer    | `src/auth/auth.service.spec.ts`                        |
| Créer    | `src/auth/auth.controller.ts`                          |
| Créer    | `src/auth/auth.module.ts`                              |

---

## Task 1 : Installer les dépendances

**Files:**

- Modify: `package.json` (via npm)

- [ ] **Étape 1 : Installer les packages**

```powershell
cd grrg-api
npm install class-validator class-transformer bcrypt
npm install --save-dev @types/bcrypt
```

- [ ] **Étape 2 : Vérifier l'installation**

```powershell
npm list class-validator class-transformer bcrypt
```

Résultat attendu : les trois packages listés sans erreur.

---

## Task 2 : Mettre à jour l'entité User

**Files:**

- Modify: `src/user/user.entity.ts`

- [ ] **Étape 1 : Ajouter la colonne `birthdate`**

Remplacer le contenu de `src/user/user.entity.ts` :

```typescript
import {
  Column,
  CreateDateColumn,
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

  @Column({ type: 'date' })
  birthdate!: Date;

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

  @CreateDateColumn()
  created_at!: Date;
}
// "!" promet une valeur car c'est au runtime que l'hydratation se fait par TypeOrm et non par le constructeur.
```

---

## Task 3 : Mettre à jour la migration

**Files:**

- Modify: `src/database/migrations/1775216576270-CreateUsers.ts`

- [ ] **Étape 1 : Ajouter la colonne `birthdate` dans le CREATE TABLE**

Remplacer le contenu de la migration :

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1775216576270 implements MigrationInterface {
  name = 'CreateUsers1775216576270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying, "pseudo" character varying(50) NOT NULL, "birthdate" date NOT NULL, "avatar_url" text, "oauth_provider" character varying(20), "oauth_id" character varying, "glow_points" integer NOT NULL DEFAULT '0', "grade" character varying(30) NOT NULL DEFAULT 'etincelle', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_c18dc5127c28389fb4ca1d8fb3c" UNIQUE ("pseudo"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

- [ ] **Étape 2 : Reset DB et relancer migration + seed**

```powershell
# Connecte-toi au conteneur postgres et drop la table
psql -h localhost -p 5433 -U grrg -d grrg_db -c "DROP TABLE IF EXISTS users CASCADE; DROP TABLE IF EXISTS migrations CASCADE;"

# Relance la migration
npm run migration:run

# Relance le seed
npm run seed:dev
```

Résultat attendu : `Migration CreateUsers1775216576270 executed` puis `Seed dev terminé.`

---

## Task 4 : UserService — tests puis implémentation

**Files:**

- Create: `src/user/user.service.spec.ts`
- Create: `src/user/user.service.ts`

- [ ] **Étape 1 : Écrire les tests**

Créer `src/user/user.service.spec.ts` :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('retourne le user si email trouvé', async () => {
      const user = { id: 'uuid', email: 'test@test.com' } as User;
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('test@test.com');

      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('retourne null si email non trouvé', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('inconnu@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findByPseudo', () => {
    it('retourne le user si pseudo trouvé', async () => {
      const user = { id: 'uuid', pseudo: 'monpseudo' } as User;
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findByPseudo('monpseudo');

      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { pseudo: 'monpseudo' },
      });
    });

    it('retourne null si pseudo non trouvé', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findByPseudo('inconnu');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('crée et retourne le user', async () => {
      const data = {
        email: 'new@test.com',
        password_hash: 'hashed',
        pseudo: 'newuser',
        birthdate: new Date('1995-06-15'),
      };
      const saved = { id: 'uuid', ...data } as User;
      mockRepo.create.mockReturnValue(data);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith(data);
      expect(mockRepo.save).toHaveBeenCalledWith(data);
      expect(result).toEqual(saved);
    });
  });
});
```

- [ ] **Étape 2 : Lancer les tests — vérifier qu'ils échouent**

```powershell
npx jest user.service.spec.ts --no-coverage
```

Résultat attendu : `Cannot find module './user.service'`

- [ ] **Étape 3 : Implémenter UserService**

Créer `src/user/user.service.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
```

- [ ] **Étape 4 : Relancer les tests — vérifier qu'ils passent**

```powershell
npx jest user.service.spec.ts --no-coverage
```

Résultat attendu : `3 tests passed`

- [ ] **Étape 5 : Commit**

```powershell
git add src/user/user.service.ts src/user/user.service.spec.ts
git commit -m "feat(user): add UserService with findByEmail, findByPseudo, create"
```

---

## Task 5 : UserModule

**Files:**

- Create: `src/user/user.module.ts`

- [ ] **Étape 1 : Créer le module**

Créer `src/user/user.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

- [ ] **Étape 2 : Commit**

```powershell
git add src/user/user.module.ts
git commit -m "feat(user): add UserModule"
```

---

## Task 6 : RegisterDto

**Files:**

- Create: `src/auth/dto/register.dto.ts`

- [ ] **Étape 1 : Créer le DTO**

Créer `src/auth/dto/register.dto.ts` :

```typescript
import {
  IsEmail,
  IsISO8601,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'pseudo ne peut contenir que des lettres, chiffres, tirets et underscores',
  })
  pseudo!: string;

  @IsISO8601({ strict: true })
  birthdate!: string;
}
```

- [ ] **Étape 2 : Commit**

```powershell
git add src/auth/dto/register.dto.ts
git commit -m "feat(auth): add RegisterDto with class-validator"
```

---

## Task 7 : AuthService — tests puis implémentation

**Files:**

- Create: `src/auth/auth.service.spec.ts`
- Create: `src/auth/auth.service.ts`

- [ ] **Étape 1 : Écrire les tests**

Créer `src/auth/auth.service.spec.ts` :

```typescript
import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

const mockUserService = {
  findByEmail: jest.fn(),
  findByPseudo: jest.fn(),
  create: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validDto = {
      email: 'new@test.com',
      password: 'password123',
      pseudo: 'newuser',
      birthdate: '1990-06-15',
    };

    it('lève ConflictException si email déjà utilisé', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'uuid' });

      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserService.findByEmail).toHaveBeenCalledWith('new@test.com');
    });

    it('lève ConflictException si pseudo déjà utilisé', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue({ id: 'uuid' });

      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserService.findByPseudo).toHaveBeenCalledWith('newuser');
    });

    it('lève UnprocessableEntityException si mineur', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue(null);

      const today = new Date();
      // Date de naissance d'un utilisateur de 17 ans
      const minor = new Date(
        today.getFullYear() - 17,
        today.getMonth(),
        today.getDate(),
      );
      const minorDto = {
        ...validDto,
        birthdate: minor.toISOString().split('T')[0],
      };

      await expect(service.register(minorDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('crée le user et retourne les données publiques sans password_hash', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      const created = {
        id: 'uuid',
        email: 'new@test.com',
        pseudo: 'newuser',
        password_hash: 'hashed',
        birthdate: new Date('1990-06-15'),
        grade: 'etincelle',
        glow_points: 0,
        created_at: new Date(),
        avatar_url: null,
        oauth_provider: null,
        oauth_id: null,
      };
      mockUserService.create.mockResolvedValue(created);

      const result = await service.register(validDto);

      expect(result).not.toHaveProperty('password_hash');
      expect(result.email).toBe('new@test.com');
      expect(result.pseudo).toBe('newuser');
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@test.com',
          pseudo: 'newuser',
          password_hash: 'hashed',
        }),
      );
    });
  });
});
```

- [ ] **Étape 2 : Lancer les tests — vérifier qu'ils échouent**

```powershell
npx jest auth.service.spec.ts --no-coverage
```

Résultat attendu : `Cannot find module './auth.service'`

- [ ] **Étape 3 : Implémenter AuthService**

Créer `src/auth/auth.service.ts` :

```typescript
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
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingPseudo = await this.userService.findByPseudo(dto.pseudo);
    if (existingPseudo) {
      throw new ConflictException('Pseudo already in use');
    }

    // Vérification que l'utilisateur a au moins 18 ans à la date du jour
    const birthdate = new Date(dto.birthdate);
    const today = new Date();
    const age =
      today.getFullYear() -
      birthdate.getFullYear() -
      (today <
      new Date(today.getFullYear(), birthdate.getMonth(), birthdate.getDate())
        ? 1
        : 0);
    if (age < 18) {
      throw new UnprocessableEntityException(
        'You must be at least 18 years old',
      );
    }

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.create({
      email: dto.email,
      password_hash,
      pseudo: dto.pseudo,
      birthdate,
    });

    // On exclut password_hash de la réponse
    const { password_hash: _, ...publicUser } = user;
    return publicUser;
  }
}
```

- [ ] **Étape 4 : Relancer les tests — vérifier qu'ils passent**

```powershell
npx jest auth.service.spec.ts --no-coverage
```

Résultat attendu : `4 tests passed`

- [ ] **Étape 5 : Commit**

```powershell
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat(auth): add AuthService register with email/pseudo/age validation and bcrypt"
```

---

## Task 8 : AuthController + AuthModule

**Files:**

- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`

- [ ] **Étape 1 : Créer le controller**

Créer `src/auth/auth.controller.ts` :

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
```

- [ ] **Étape 2 : Créer le module**

Créer `src/auth/auth.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

- [ ] **Étape 3 : Commit**

```powershell
git add src/auth/auth.controller.ts src/auth/auth.module.ts
git commit -m "feat(auth): add AuthController POST /auth/register and AuthModule"
```

---

## Task 9 : Brancher dans AppModule + ValidationPipe global

**Files:**

- Modify: `src/app.module.ts`
- Modify: `src/main.ts`

- [ ] **Étape 1 : Mettre à jour AppModule**

Remplacer le contenu de `src/app.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: false,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Étape 2 : Activer ValidationPipe global dans main.ts**

Remplacer le contenu de `src/main.ts` :

```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
```

- [ ] **Étape 3 : Commit**

```powershell
git add src/app.module.ts src/main.ts
git commit -m "feat: register AuthModule and UserModule, enable global ValidationPipe"
```

---

## Task 10 : Test manuel end-to-end

- [ ] **Étape 1 : Lancer l'API**

```powershell
npm run start:dev
```

- [ ] **Étape 2 : Cas nominal**

```powershell
curl -X POST http://localhost:3001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@grrg.com","password":"motdepasse123","pseudo":"testuser","birthdate":"1995-06-15"}'
```

Résultat attendu : `201` avec `id`, `email`, `pseudo`, `grade`, `glow_points`, `birthdate`, `created_at` — sans `password_hash`.

- [ ] **Étape 3 : Email déjà utilisé**

```powershell
curl -X POST http://localhost:3001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@grrg.com","password":"motdepasse123","pseudo":"autrepseudo","birthdate":"1995-06-15"}'
```

Résultat attendu : `409` `"Email already in use"`

- [ ] **Étape 4 : Mineur**

```powershell
curl -X POST http://localhost:3001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"young@grrg.com","password":"motdepasse123","pseudo":"youngster","birthdate":"2015-01-01"}'
```

Résultat attendu : `422` `"You must be at least 18 years old"`

- [ ] **Étape 5 : Champ invalide**

```powershell
curl -X POST http://localhost:3001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"pasunemail","password":"court","pseudo":"ok","birthdate":"1995-06-15"}'
```

Résultat attendu : `400` avec messages class-validator.
