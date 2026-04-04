import {
  ConflictException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmail: jest.fn(),
    findByPseudo: jest.fn(),
    create: jest.fn(),
  };
  const mockJwtService = { signAsync: jest.fn(), verify: jest.fn() };
  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  };
  const mockRefreshTokenRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      pseudo: 'testuser',
      birthdate: '1990-01-01',
    };

    it('should register a user and return public data without password_hash', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUserService.create.mockResolvedValue({
        id: 'uuid',
        email: dto.email,
        pseudo: dto.pseudo,
        birthdate: new Date(dto.birthdate),
        password_hash: 'hashed-password',
        avatar_url: null,
        oauth_provider: null,
        oauth_id: null,
        glow_points: 0,
        grade: 'etincelle',
        created_at: new Date(),
      });

      const result = await service.register(dto);
      expect(result).not.toHaveProperty('password_hash');
      expect(result.email).toBe(dto.email);
    });

    it('should throw ConflictException if email already in use', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if pseudo already in use', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw UnprocessableEntityException if user is under 18', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue(null);
      const today = new Date();
      const underageDate = `${today.getFullYear() - 17}-01-01`;
      await expect(
        service.register({ ...dto, birthdate: underageDate }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('login', () => {
    it('should return access_token and refresh_token for valid credentials', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
      expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-id' }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user has no password_hash (compte OAuth)', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'uid',
        email: 'x@x.com',
        password_hash: null,
      });
      await expect(
        service.login({ email: 'x@x.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'uid',
        email: 'x@x.com',
        password_hash: 'hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'x@x.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens and return new access_token + refresh_token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        email: 'test@example.com',
        jti: 'old-jti',
      });
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 'old-jti' });
      mockRefreshTokenRepo.delete.mockResolvedValue({});
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.refresh('valid-refresh-token');
      expect(result).toEqual({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      });
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        id: 'old-jti',
      });
    });

    it('should throw UnauthorizedException if token signature is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is not in DB (révoqué)', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'uid',
        email: 'x@x.com',
        jti: 'jti',
      });
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete the refresh token from DB', async () => {
      mockJwtService.verify.mockReturnValue({ jti: 'jti-to-delete' });
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      await service.logout('valid-refresh-token');
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        id: 'jti-to-delete',
      });
    });

    it('should resolve silently if refresh token is invalid (déjà expiré)', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(mockRefreshTokenRepo.delete).not.toHaveBeenCalled();
    });
  });
});
