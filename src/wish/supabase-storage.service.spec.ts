import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn();

// Mock du module avant l'import du service — createClient est appelé dans le constructeur
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: { from: mockFrom },
  }),
}));

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;

  beforeEach(async () => {
    mockFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseStorageService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                SUPABASE_URL: 'https://test.supabase.co',
                SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
              };
              if (map[key]) return map[key];
              throw new Error(`Clé inconnue : ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get<SupabaseStorageService>(SupabaseStorageService);
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });
  });

  const mockFile = {
    buffer: Buffer.from('contenu-image'),
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
  } as Express.Multer.File;

  it("upload() retourne l'URL publique quand Supabase répond sans erreur", async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user-id/photo.jpg' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://cdn.supabase.co/storage/v1/object/public/wishes-media/user-id/photo.jpg',
      },
    });

    const url = await service.upload(
      'wishes-media',
      'user-id/photo.jpg',
      mockFile,
    );

    expect(mockFrom).toHaveBeenCalledWith('wishes-media');
    expect(mockUpload).toHaveBeenCalledWith(
      'user-id/photo.jpg',
      Buffer.from('contenu-image'),
      {
        contentType: 'image/jpeg',
        upsert: false,
      },
    );
    expect(url).toBe(
      'https://cdn.supabase.co/storage/v1/object/public/wishes-media/user-id/photo.jpg',
    );
  });

  it('upload() lance InternalServerErrorException si Supabase retourne une erreur', async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    await expect(
      service.upload('wishes-media', 'user-id/photo.jpg', mockFile),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
