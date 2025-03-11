import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createMock } from '@golevelup/ts-jest';

jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const mockContext = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userRoles: [Role.USER] },
        }),
      }),
      getType: () => 'http',
    });

    expect(await guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow access when user has required role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    const mockContext = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userRoles: [Role.ADMIN] },
        }),
      }),
      getType: () => 'http',
    });

    expect(await guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny access when user lacks required role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    const mockContext = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userRoles: [Role.USER] },
        }),
      }),
      getType: () => 'http',
    });

    expect(await guard.canActivate(mockContext)).toBe(false);
  });

  it('should handle GraphQL context', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    const mockContext = createMock<ExecutionContext>({
      getType: () => 'graphql',
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userRoles: [Role.ADMIN] },
        }),
      }),
    });

    // Mock the GqlExecutionContext.create implementation for this test
    (GqlExecutionContext.create as jest.Mock).mockImplementation(() => ({
      getContext: () => ({
        req: {
          user: { userRoles: [Role.ADMIN] },
        },
      }),
    }));

    expect(await guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw UnauthorizedException when no user in request', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    const mockContext = createMock<ExecutionContext>({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({}), // Empty request with no user
      }),
    });

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
