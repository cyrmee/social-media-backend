import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return all users with mapped fields', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          username: 'user1',
          profilePicture: null,
          bio: null,
          userRoles: ['USER'],
        },
        {
          id: '2',
          email: 'user2@example.com',
          username: 'user2',
          profilePicture: 'profile.jpg',
          bio: 'Test bio',
          userRoles: ['ADMIN'],
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsers();
      expect(result).toHaveLength(2);
      expect(result[0].profilePicture).toBe('');
      expect(result[0].bio).toBe('');
      expect(result[1].profilePicture).toBe('profile.jpg');
      expect(result[1].bio).toBe('Test bio');
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        profilePicture: 'avatar.jpg',
        bio: 'Test bio',
        isVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        twoFactorEnabled: false,
        userRoles: ['USER'],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('1');
      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
      expect(result?.roles).toEqual(mockUser.userRoles);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return complete profile with counts', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        profilePicture: 'avatar.jpg',
        bio: 'Test bio',
        isVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        twoFactorEnabled: false,
        userRoles: ['USER'],
        _count: {
          posts: 5,
          followers: 10,
          following: 15,
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('1');
      expect(result).toBeDefined();
      expect(result?.postCount).toBe(5);
      expect(result?.followerCount).toBe(10);
      expect(result?.followingCount).toBe(15);
      expect(result?._count).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent profile', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      const mockUser = {
        userRoles: ['USER', 'ADMIN'],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserRoles('1');
      expect(result).toEqual(['USER', 'ADMIN']);
    });

    it('should return empty array if no roles found', async () => {
      const mockUser = {
        userRoles: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserRoles('1');
      expect(result).toEqual([]);
    });
  });
});
