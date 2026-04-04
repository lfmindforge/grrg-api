import { Injectable } from '@nestjs/common';

@Injectable()
export class WishService {
  // US-005 remplacera ce stub par une requête TypeORM avec filtre is_private = false
  findPublic(): Promise<never[]> {
    return Promise.resolve([]);
  }
}
