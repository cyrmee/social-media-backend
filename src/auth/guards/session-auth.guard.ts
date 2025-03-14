import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let request;
    if (context.getType<string>() === 'http') {
      request = context.switchToHttp().getRequest();
    } else if (context.getType<string>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext().req;
    }

    const sessionId = request?.sessionID;
    if (!sessionId) {
      throw new UnauthorizedException('No session found');
    }

    const sessionData = await this.authService.getSessionData(sessionId);
    if (!sessionData) {
      throw new UnauthorizedException('Invalid session');
    }

    // Allow access to 2FA setup routes if user is logging in for first time
    if (
      request.path.startsWith('/auth/2fa/generate') &&
      !sessionData.twoFactorEnabled
    ) {
      return true;
    }

    // Allow access to 2FA verification route if user needs to verify
    if (
      request.path === '/auth/2fa/verify' &&
      sessionData.twoFactorEnabled &&
      !sessionData.verified2FA
    ) {
      return true;
    }

    // Then check 2FA verification status
    if (
      sessionData.twoFactorEnabled &&
      sessionData.requires2FA &&
      !sessionData.verified2FA
    ) {
      throw new UnauthorizedException('2FA verification required');
    }

    // For all other routes, check user status first
    const user = await this.authService.getUserFromSession(sessionId);
    if (!user?.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Attach the user to the request so it's available for controllers and other guards
    request.user = user;

    return true;
  }
}
