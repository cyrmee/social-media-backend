import { Test, TestingModule } from '@nestjs/testing';
import { SessionAuthGuard } from './session-auth.guard';
import { AuthService } from '../auth.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createMock } from '@golevelup/ts-jest';

jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let authService: AuthService;

  const mockAuthService = {
    getSessionData: jest.fn(),
    getUserFromSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthGuard,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<SessionAuthGuard>(SessionAuthGuard);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('HTTP Requests', () => {
    it('should allow access when session and user are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        isActive: true,
      };

      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        verified2FA: true,
      };

      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);
      mockAuthService.getUserFromSession.mockResolvedValue(mockUser);

      const mockContext = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            sessionID: 'test-session-id',
            path: '/api/test',
          }),
        }),
      });

      expect(await guard.canActivate(mockContext)).toBe(true);
    });

    it('should deny access when no session ID', async () => {
      const mockContext = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle 2FA setup routes correctly', async () => {
      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        twoFactorEnabled: false,
        verified2FA: false,
      };

      const mockContext = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            sessionID: 'test-session-id',
            path: '/auth/2fa/generate',
          }),
        }),
      });

      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);

      expect(await guard.canActivate(mockContext)).toBe(true);
    });

    it('should deny access when user is inactive', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        isActive: false,
      };

      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        verified2FA: true,
      };

      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);
      mockAuthService.getUserFromSession.mockResolvedValue(mockUser);

      const context = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            sessionID: 'test-session-id',
            path: '/api/test',
          }),
        }),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GraphQL Requests', () => {
    it('should handle GraphQL context correctly', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        isActive: true,
      };

      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        verified2FA: true,
      };

      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);
      mockAuthService.getUserFromSession.mockResolvedValue(mockUser);

      const mockContext = createMock<ExecutionContext>({
        getType: () => 'graphql',
      });

      (GqlExecutionContext.create as jest.Mock).mockImplementation(() => ({
        getContext: () => ({
          req: {
            sessionID: 'test-session-id',
            path: '/graphql',
          },
        }),
      }));

      expect(await guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('2FA Flow', () => {
    it('should handle unverified 2FA correctly', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        isActive: true,
        twoFactorEnabled: true,
      };
      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        requires2FA: true,
        verified2FA: false,
      };
      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);
      mockAuthService.getUserFromSession.mockResolvedValue(mockUser);
      const mockContext = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            sessionID: 'test-session-id',
            path: '/auth/2fa/verify',
          }),
        }),
      });
      expect(await guard.canActivate(mockContext)).toBe(true);
    });

    it('should deny access to protected routes when 2FA not verified', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        isActive: true,
        twoFactorEnabled: true,
      };
      const mockSessionData = {
        userId: '1',
        email: 'test@example.com',
        requires2FA: true,
        verified2FA: false,
      };
      mockAuthService.getSessionData.mockResolvedValue(mockSessionData);
      mockAuthService.getUserFromSession.mockResolvedValue(mockUser);

      const mockContext = createMock<ExecutionContext>({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            sessionID: 'test-session-id',
            path: '/api/protected',
          }),
        }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
