import { Body, Controller, Get, Patch, Query, Request } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';

@Controller('users/me/settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  getSettings(
    @Request() req: { user: { id: string } },
    @Query('prefix') prefix?: string,
  ) {
    return this.service.getByPrefix(req.user.id, prefix ?? '');
  }

  @Patch()
  updateSettings(
    @Request() req: { user: { id: string } },
    @Body() body: Record<string, unknown>,
  ) {
    return Promise.all(
      Object.entries(body).map(([key, value]) => this.service.set(req.user.id, key, value)),
    );
  }
}
