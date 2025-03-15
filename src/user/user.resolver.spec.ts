import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { Role } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let userService: UserService;

  const mockUserService = {
    getProfile: jest.fn(),
    getAllUsers: jest.fn(),
  };

  const mockAuthService = {
    getSessionData: jest.fn(),
    getUserFromSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: SessionAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('profile', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        profilePicture: 'avatar.jpg',
        bio: 'Test bio',
        userRoles: [Role.USER],
        isVerified: true,
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContext = {
        req: {
          user: { id: '1' },
        },
      };

      mockUserService.getProfile.mockResolvedValue(mockProfile);

      const result = await resolver.profile(mockContext);
      expect(result).toBeDefined();
      expect(result.email).toBe(mockProfile.email);
      expect(result.roles).toEqual(mockProfile.userRoles); // Test that userRoles gets mapped to roles
      expect(result.profilePicture).toBe(mockProfile.profilePicture);
    });
  });

  describe('users', () => {
    it('should return all users for admin query', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          username: 'user1',
          name: 'User One',
          profilePicture: 'avatar1.jpg',
          bio: 'Bio 1',
          roles: [Role.USER],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          email: 'user2@example.com',
          username: 'user2',
          name: 'User Two',
          profilePicture: 'avatar2.jpg',
          bio: 'Bio 2',
          roles: [Role.ADMIN],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockUserService.getAllUsers.mockResolvedValue(mockUsers);

      const result = await resolver.users();
      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe(mockUsers[0].email);
      expect(result[1].email).toBe(mockUsers[1].email);
      expect(result[0].roles).toEqual(mockUsers[0].roles);
      expect(result[1].roles).toEqual(mockUsers[1].roles);
    });

    it('should properly format user fields', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        profilePicture: null,
        bio: null,
        roles: [Role.USER],
        createdAt: new Date(),
        updatedAt: null,
      };

      mockUserService.getAllUsers.mockResolvedValue([mockUser]);

      const result = await resolver.users();
      expect(result[0].profilePicture).toBe('');
      expect(result[0].bio).toBe('');
      expect(result[0].updatedAt).toEqual(mockUser.createdAt);
    });
  });
});
