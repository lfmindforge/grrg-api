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
