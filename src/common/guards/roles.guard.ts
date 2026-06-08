import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Pas de décorateur @Roles() : laisse passer
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    if (!required.includes(user?.role ?? '')) {
      throw new ForbiddenException('Accès réservé');
    }
    return true;
  }
}
