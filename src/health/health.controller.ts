import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Inject(CACHE_MANAGER) private readonly cache: any,
  ) {}

  @Get()
  @Public()
  async check() {
    const [database, redis] = await Promise.all([
      this.dataSource.query('SELECT 1').then(() => 'connected').catch(() => 'disconnected'),
      this.cache.set('__health__', '1', 5).then(() => 'connected').catch(() => 'disconnected'),
    ]);

    const status = database === 'connected' && redis === 'connected' ? 'ok' : 'degraded';

    return {
      status,
      database,
      redis,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
