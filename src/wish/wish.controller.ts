import { Controller, Get } from '@nestjs/common';
import { WishService } from './wish.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('wishes')
export class WishController {
  constructor(private readonly wishService: WishService) {}

  @Get()
  @Public()
  findPublic() {
    return this.wishService.findPublic();
  }
}
