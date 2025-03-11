import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto } from './dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUsers(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({});

    return users.map((user) => ({
      ...user,
      profilePicture: user.profilePicture || '',
      bio: user.bio || '',
      roles: user.userRoles,
    }));
  }

  async getUserById(id: string): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        profilePicture: true,
        bio: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        twoFactorEnabled: true,
        userRoles: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return {
      ...user,
      profilePicture: user.profilePicture || '',
      bio: user.bio || '',
      roles: user.userRoles,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        profilePicture: true,
        bio: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        twoFactorEnabled: true,
        userRoles: true,
        // Exclude sensitive fields like hash, twoFactorSecret, etc.
        // Include aggregate data
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      ...user,
      roles: user.userRoles,
      userRoles: undefined, // Remove userRoles from the response
      postCount: user._count.posts,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      _count: undefined, // Remove the _count property from response
    };
  }

  async getAllUsers(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        profilePicture: true,
        bio: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        userRoles: true,
      },
    });

    return users.map((user) => ({
      ...user,
      profilePicture: user.profilePicture || '',
      roles: user.userRoles,
      bio: user.bio || '',
      userRoles: undefined, // Remove userRoles from the response
    }));
  }

  async addRoleToUser(userId: string, roleType: string) {}

  async removeRoleFromUser(userId: string, roleType: string) {}

  async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.userRoles || [];
  }
}
