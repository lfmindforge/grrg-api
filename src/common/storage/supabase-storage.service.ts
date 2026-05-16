import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  async upload(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) {
      throw new InternalServerErrorException(
        `Échec upload Supabase : ${error.message}`,
      );
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  extractPath(bucket: string, url: string): string | null {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    return idx >= 0 ? url.slice(idx + marker.length) : null;
  }

  async delete(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.warn(`Supabase cleanup [${bucket}]: ${error.message}`);
    }
  }
}
