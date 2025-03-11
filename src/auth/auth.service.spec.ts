import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let redisClient: any;

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without hash if credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        hash: await argon2.hash('password123'),
        username: 'testuser',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );
      expect(result).toBeDefined();
      expect(result.hash).toBeUndefined();
      expect(result.id).toBe('1');
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create a new user successfully', async () => {
      const registerData = {
        email: 'new@example.com',
        username: 'newuser',
        password: 'Password123!',
        name: 'New User',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...registerData,
        id: '1',
        hash: 'hashedpassword',
        userRoles: Role.USER,
      });

      const result = await service.register(registerData);
      expect(result).toBeDefined();
      expect(result.email).toBe(registerData.email);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const registerData = {
        email: 'existing@example.com',
        username: 'existinguser',
        password: 'Password123!',
        name: 'Existing User',
      };

      mockPrismaService.user.findFirst.mockResolvedValue({ id: '1' });

      await expect(service.register(registerData)).rejects.toThrow();
    });
  });

  describe('2FA Operations', () => {
    it('should generate 2FA secret and QR code', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        hash: 'hashedpassword',
        profilePicture: null,
        bio: null,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        userRoles: [Role.USER],
      };

      mockConfigService.get.mockReturnValue('TestApp');
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result =
        await service.generateTwoFactorAuthenticationSecret(mockUser);
      expect(result.secret).toBeDefined();
      expect(result.qrCodeDataURL).toBeDefined();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should generate 2FA secret', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        hash: 'hashedpassword',
        profilePicture: null,
        bio: null,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        userRoles: [Role.USER],
      };

      mockConfigService.get.mockReturnValue('TestApp');
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result =
        await service.generateTwoFactorAuthenticationSecret(mockUser);
      expect(result.secret).toBeDefined();
      expect(result.qrCodeDataURL).toBeDefined();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should get session data from Redis', async () => {
      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSessionData));

      const result = await service.getSessionData('test-session-id');
      expect(result).toEqual(mockSessionData);
    });

    it('should return null for invalid session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getSessionData('invalid-session-id');
      expect(result).toBeNull();
    });
  });
});
