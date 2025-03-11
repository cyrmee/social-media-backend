import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    generateTwoFactorAuthenticationSecret: jest.fn(),
    enableTwoFactorAuthentication: jest.fn(),
    validateTwoFactorAuthenticationCode: jest.fn(),
    getSessionData: jest.fn(),
    getUserFromSession: jest.fn(),
    sendTwoFactorCode: jest.fn(),
    refreshSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        name: 'Test User',
      };

      const expectedResponse = {
        id: '1',
        email: registerDto.email,
        username: registerDto.username,
        name: registerDto.name,
      };

      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);
      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login and return user data with session', async () => {
      const req = {
        user: {
          id: '1',
          email: 'test@example.com',
        },
        sessionID: 'test-session-id',
      };

      const expectedResponse = {
        id: '1',
        email: 'test@example.com',
        requires2FA: true,
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(req, {} as any);
      expect(result).toEqual({
        ...expectedResponse,
        sessionId: 'test-session-id',
      });
      expect(mockAuthService.login).toHaveBeenCalledWith(
        req.user,
        req.sessionID,
      );
    });
  });

  describe('2FA Operations', () => {
    it('should generate 2FA secret', async () => {
      const req = {
        user: {
          id: '1',
          email: 'test@example.com',
        },
      };

      const expectedResponse = {
        secret: 'testsecret',
        qrCodeDataURL: 'testqrcode',
      };

      mockAuthService.generateTwoFactorAuthenticationSecret.mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.generateTwoFactorAuth(req);
      expect(result).toEqual(expectedResponse);
    });

    it('should enable 2FA', async () => {
      const req = {
        user: {
          id: '1',
        },
        sessionID: 'test-session-id',
      };

      const body = {
        twoFactorCode: '123456',
      };

      const expectedResponse = {
        message: 'Two-factor authentication enabled successfully',
      };

      mockAuthService.enableTwoFactorAuthentication.mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.enableTwoFactorAuth(req, body);
      expect(result).toEqual(expectedResponse);
    });

    it('should verify 2FA code', async () => {
      const req = {
        sessionID: 'test-session-id',
      };

      const body = {
        twoFactorCode: '123456',
      };

      mockAuthService.getSessionData.mockResolvedValue({ userId: '1' });
      mockAuthService.validateTwoFactorAuthenticationCode.mockResolvedValue({
        message: 'Code verified successfully',
      });

      const result = await controller.verifyTwoFactorAuth(body, req);
      expect(result).toBeDefined();
      expect(result.message).toBe('Code verified successfully');
    });

    it('should throw UnauthorizedException when no session for 2FA verification', async () => {
      const req = {};
      const body = {
        twoFactorCode: '123456',
      };

      await expect(controller.verifyTwoFactorAuth(body, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Admin and Moderator Routes', () => {
    it('should allow admin access', async () => {
      const req = {
        user: {
          id: '1',
          email: 'admin@example.com',
          userRoles: [Role.ADMIN],
        },
      };

      const result = await controller.adminRoute(req);
      expect(result).toEqual({
        message: 'Admin area accessed successfully',
        user: req.user,
      });
    });

    it('should allow moderator access', async () => {
      const req = {
        user: {
          id: '1',
          email: 'mod@example.com',
          userRoles: [Role.MODERATOR],
        },
      };

      const result = await controller.moderatorRoute(req);
      expect(result).toEqual({
        message: 'Moderator area accessed successfully',
        user: req.user,
      });
    });
  });
});
