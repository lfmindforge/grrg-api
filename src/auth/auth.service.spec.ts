import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

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
