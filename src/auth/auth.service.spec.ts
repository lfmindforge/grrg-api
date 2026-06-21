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
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmail: jest.fn(),
    findByPseudo: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByOAuthId: jest.fn(),
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
  const mockEventService = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: EventLogService, useValue: mockEventService },
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

    it('log user.register après inscription réussie', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByPseudo.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockUserService.create.mockResolvedValue({ id: 'new-id', email: 'a@b.com', pseudo: 'alex', password_hash: 'hashed' });

      await service.register({ email: 'a@b.com', password: 'pass1234', pseudo: 'alex', birthdate: '1990-01-01' });

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_REGISTER,
        'new-id',
        expect.objectContaining({ pseudo: 'alex', method: 'email' }),
      );
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
        role: 'user',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.login({ email: 'test@example.com', password: 'password123' });
      expect(result).toEqual({ access_token: 'access-token', refresh_token: 'refresh-token' });
      expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-id' }));
    });

    it('log user.login après connexion réussie', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'u-1', email: 'a@b.com', password_hash: 'h', role: 'user' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      await service.login({ email: 'a@b.com', password: 'pass' });

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_LOGIN,
        'u-1',
        expect.objectContaining({ method: 'email' }),
      );
    });

    it('log user.login_failed si email inconnu', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'x@x.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_LOGIN_FAILED,
        null,
        expect.objectContaining({ email: 'x@x.com' }),
      );
    });

    it('log user.login_failed si mot de passe incorrect', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'u-1', email: 'a@b.com', password_hash: 'h', role: 'user' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_LOGIN_FAILED,
        'u-1',
        expect.objectContaining({ email: 'a@b.com' }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'password123' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user has no password_hash (compte OAuth)', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'uid', email: 'x@x.com', password_hash: null });
      await expect(service.login({ email: 'x@x.com', password: 'password123' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'uid', email: 'x@x.com', password_hash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'x@x.com', password: 'wrongpass' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens and return new access_token + refresh_token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-id', email: 'test@example.com', jti: 'old-jti' });
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 'old-jti' });
      mockRefreshTokenRepo.delete.mockResolvedValue({});
      mockUserService.findById.mockResolvedValue({ id: 'user-id', email: 'test@example.com', role: 'user' });
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.refresh('valid-refresh-token');
      expect(result).toEqual({ access_token: 'new-access', refresh_token: 'new-refresh' });
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({ id: 'old-jti' });
    });

    it('should throw UnauthorizedException if token signature is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid signature'); });
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is not in DB (révoqué)', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'uid', email: 'x@x.com', jti: 'jti' });
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete the refresh token from DB', async () => {
      mockJwtService.verify.mockReturnValue({ jti: 'jti-to-delete', sub: 'user-id' });
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      await service.logout('valid-refresh-token');
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({ id: 'jti-to-delete' });
    });

    it('log user.logout après déconnexion réussie', async () => {
      mockJwtService.verify.mockReturnValue({ jti: 'jti-1', sub: 'u-1' });
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      await service.logout('valid-refresh-token');

      expect(mockEventService.log).toHaveBeenCalledWith(EventType.USER_LOGOUT, 'u-1', {});
    });

    it('should resolve silently if refresh token is invalid (déjà expiré)', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(mockRefreshTokenRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateOAuthUser', () => {
    const profile = {
      provider: 'google' as const,
      oauthId: 'google-123',
      email: 'oauth@example.com',
      displayName: 'Lucas Dupont',
      avatarUrl: 'https://avatar.url/photo.jpg',
    };

    it('should return tokens for existing OAuth user', async () => {
      mockUserService.findByOAuthId.mockResolvedValue({ id: 'user-id', email: 'oauth@example.com', role: 'user' });
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.findOrCreateOAuthUser(profile);
      expect(result).toEqual({ access_token: 'access-token', refresh_token: 'refresh-token' });
      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    it('log user.login_oauth pour un utilisateur OAuth existant', async () => {
      mockUserService.findByOAuthId.mockResolvedValue({ id: 'user-id', email: 'oauth@example.com', role: 'user' });
      mockJwtService.signAsync.mockResolvedValue('token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      await service.findOrCreateOAuthUser(profile);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_LOGIN_OAUTH,
        'user-id',
        expect.objectContaining({ provider: 'google' }),
      );
    });

    it('should throw ConflictException if email already used by non-OAuth account', async () => {
      mockUserService.findByOAuthId.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue({ id: 'existing-id', oauth_provider: null });
      await expect(service.findOrCreateOAuthUser(profile)).rejects.toThrow(ConflictException);
    });

    it('should create account and return tokens for new OAuth user', async () => {
      mockUserService.findByOAuthId.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue({ id: 'new-id', email: 'oauth@example.com', pseudo: 'lucas_ab12', role: 'user' });
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const result = await service.findOrCreateOAuthUser(profile);
      expect(result).toEqual({ access_token: 'access-token', refresh_token: 'refresh-token' });
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'oauth@example.com', oauth_provider: 'google', oauth_id: 'google-123', password_hash: null }),
      );
    });

    it('log user.register + user.login_oauth pour un nouvel utilisateur OAuth', async () => {
      mockUserService.findByOAuthId.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue({ id: 'new-id', email: 'oauth@example.com', pseudo: 'lucas_ab12', role: 'user' });
      mockJwtService.signAsync.mockResolvedValue('token');
      mockRefreshTokenRepo.save.mockResolvedValue({});

      await service.findOrCreateOAuthUser(profile);

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_REGISTER,
        'new-id',
        expect.objectContaining({ method: 'google' }),
      );
      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.USER_LOGIN_OAUTH,
        'new-id',
        expect.objectContaining({ provider: 'google' }),
      );
    });
  });
});
