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
    if (context.getType() === 'http') {
      request = context.switchToHttp().getRequest();
    } else {
      const gqlContext = GqlExecutionContext.create(context);
      request = gqlContext.getContext().req;
    }

    // Get session ID from the session cookie
    const sessionId = request.sessionID;
    if (!sessionId) {
      throw new UnauthorizedException('No session found');
    }

    // Get session data directly from Redis to check 2FA verification status
    const sessionData = await this.authService.getSessionData(sessionId);
    if (!sessionData) {
      throw new UnauthorizedException('Invalid session');
    }

    // Check if user should be allowed on 2FA setup routes
    const is2FASetupRoute =
      request.path.includes('/2fa/generate') ||
      request.path.includes('/2fa/enable');

    // If it's a 2FA setup route and the user doesn't have 2FA enabled
    if (is2FASetupRoute && !sessionData.twoFactorEnabled) {
      // Allow minimal access for setup with limited user info
      request.user = {
        id: sessionData.userId,
        email: sessionData.email,
        role: sessionData.role,
      };
      return true;
    }

    // Get full user from session (will be null if 2FA not verified or not enabled)
    const user = await this.authService.getUserFromSession(sessionId);

    // User has not verified 2FA yet, or has not set up 2FA
    if (!user) {
      // Store minimal user info in request
      request.user = {
        id: sessionData.userId,
        twoFactorEnabled: sessionData.twoFactorEnabled || false,
        requires2FA: true,
        verified2FA: sessionData.verified2FA || false,
      };

      // If user has 2FA enabled but not verified, only allow access to verification endpoints
      if (sessionData.twoFactorEnabled) {
        const is2FAVerifyRoute =
          request.path.includes('/2fa/verify') ||
          request.path.includes('/2fa/send');

        if (!is2FAVerifyRoute) {
          throw new UnauthorizedException('Two-factor authentication required');
        }
      } else {
        // User doesn't have 2FA enabled at all - only allow access to setup routes
        if (!is2FASetupRoute) {
          throw new UnauthorizedException(
            'Two-factor authentication setup required',
          );
        }
      }
      return true;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Set complete user object in request - this means user has 2FA enabled and verified
    request.user = user;
    return true;
  }
}
