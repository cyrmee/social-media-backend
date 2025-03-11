import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    let user;
    if (context.getType<string>() === 'http') {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    } else if (context.getType<string>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext();
      user = ctx.req?.user;
    }

    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }

    return requiredRoles.some((role) => user.userRoles?.includes(role));
  }
}
