import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Route marquée @Public() : on court-circuite Passport sans vérifier le token
    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Route marquée @OptionalAuth() : on tente l'auth Passport mais on ne bloque pas si absent
    if (isOptional) {
      return (super.canActivate(context) as Promise<boolean>).catch(() => true);
    }

    return super.canActivate(context);
  }

  // Empêche Passport de lever une UnauthorizedException sur les routes @OptionalAuth()
  handleRequest(err: unknown, user: unknown, _info: unknown, context: ExecutionContext) {
    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOptional) return user ?? null;
    return super.handleRequest(err, user, _info, context);
  }
}
