import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { User, Role } from '@prisma/client';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: any,
    private configService: ConfigService,
  ) {}

  // Get raw session data from Redis
  async getSessionData(sessionId: string) {
    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      return null;
    }
    return JSON.parse(sessionData);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await argon2.verify(user.hash, pass))) {
      const { hash, ...result } = user;
      return result;
    }
    return null;
  }

  async register(userData: any): Promise<User> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: userData.email }, { username: userData.username }],
      },
    });

    if (existingUser) {
      throw new ForbiddenException(
        'User with this email or username already exists',
      );
    }

    const hash = await argon2.hash(userData.password);
    return this.prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        name: userData.name,
        hash,
        userRoles: userData.role || Role.USER,
      },
    });
  }

  async login(user: any, sessionId: string) {
    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Always set requires2FA to true, and verified2FA to false until verification
    await this.redisClient.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.userRoles,
        requires2FA: true,
        verified2FA: false,
        twoFactorEnabled: user.twoFactorEnabled || false,
      }),
      { EX: 60 * 60 * 24 * 7 },
    ); // Expire in 7 days

    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.userRoles,
      requires2FA: true, // Always require 2FA
      twoFactorEnabled: user.twoFactorEnabled || false,
    };

    return userResponse;
  }

  async logout(sessionId: string) {
    await this.redisClient.del(`session:${sessionId}`);
    return { message: 'Logged out successfully' };
  }

  async generateTwoFactorAuthenticationSecret(user: User) {
    const secret = authenticator.generateSecret();
    const appName = this.configService.get('APP_NAME', 'SocialMediaApp');
    const otpAuthUrl = authenticator.keyuri(user.email, appName, secret);

    // Save the secret to the user record temporarily
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    // Generate QR code
    const qrCodeDataURL = await toDataURL(otpAuthUrl);

    return {
      secret,
      qrCodeDataURL,
    };
  }

  async enableTwoFactorAuthentication(
    userId: string,
    twoFactorCode: string,
    sessionId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication not set up');
    }

    const isCodeValid = authenticator.verify({
      token: twoFactorCode,
      secret: user.twoFactorSecret,
    });

    if (!isCodeValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    // Enable 2FA for the user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        // Generate a set of backup codes (simplified version)
        twoFactorBackupCodes: JSON.stringify(
          Array.from({ length: 5 }, () =>
            Math.random().toString(36).substring(2, 12).toUpperCase(),
          ),
        ),
      },
    });

    await this.validateTwoFactorAuthenticationCode(sessionId, twoFactorCode);

    return {
      message: 'Two-factor authentication enabled successfully',
    };
  }

  async validateTwoFactorAuthenticationCode(
    sessionId: string,
    twoFactorCode: string,
  ) {
    // Get session data
    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = JSON.parse(sessionData);
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication not set up');
    }

    const isCodeValid = authenticator.verify({
      token: twoFactorCode,
      secret: user.twoFactorSecret,
    });

    if (!isCodeValid) {
      // Check if the code is a backup code
      const backupCodes = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : [];
      const isBackupCodeValid = backupCodes.includes(twoFactorCode);

      if (!isBackupCodeValid) {
        throw new UnauthorizedException('Invalid two-factor code');
      }

      // Remove the used backup code
      const updatedBackupCodes = backupCodes.filter(
        (code: string) => code !== twoFactorCode,
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: JSON.stringify(updatedBackupCodes) },
      });
    }

    // Update session to mark 2FA as verified
    await this.redisClient.set(
      `session:${sessionId}`,
      JSON.stringify({
        ...session,
        verified2FA: true,
      }),
      { EX: 60 * 60 * 24 * 7 },
    ); // Expire in 7 days

    return {
      message: 'Two-factor authentication verified successfully',
    };
  }

  async getUserFromSession(sessionId: string) {
    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // If 2FA is required but not verified, don't return the user
    if (session.requires2FA && !session.verified2FA) {
      return null;
    }

    // Get user data
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        userRoles: true,
        profilePicture: true,
        bio: true,
        isVerified: true,
        isActive: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If user doesn't exist or doesn't have 2FA enabled, deny access
    if (!user || !user.twoFactorEnabled) {
      return null;
    }

    return user;
  }

  async refreshSession(sessionId: string) {
    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = JSON.parse(sessionData);

    // Extend the session TTL
    await this.redisClient.set(`session:${sessionId}`, sessionData, {
      EX: 60 * 60 * 24 * 7, // Refresh for another 7 days
    });

    console.log(
      `Session ${sessionId} refreshed at ${new Date().toISOString()}`,
    );

    return {
      message: 'Session refreshed successfully',
    };
  }

  async sendTwoFactorCode(userId: string) {
    // In a real application, this would send the code via SMS or email
    // For demo purposes, we'll just return a message
    return {
      message:
        "In a production app, a 2FA code would be sent to the user's phone or email",
    };
  }
}
