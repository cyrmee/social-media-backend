import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Resolver(() => UserDto)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => UserDto)
  @UseGuards(SessionAuthGuard)
  async profile(@Context() context): Promise<UserDto> {
    const user = context.req.user;

    // If we get here, 2FA is either not required or has been verified
    const profile = await this.userService.getProfile(user.id);
    return {
      ...profile,
      profilePicture: profile.profilePicture || '',
      bio: profile.bio || '',
      roles: profile.roles || [],
      updatedAt: profile.updatedAt || profile.createdAt,
    };
  }

  @Query(() => [UserDto])
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async users(): Promise<UserDto[]> {
    const users = await this.userService.getAllUsers();
    return users.map((user) => ({
      ...user,
      profilePicture: user.profilePicture || '',
      bio: user.bio || '',
      roles: user.roles || [],
      updatedAt: user.updatedAt || user.createdAt,
    }));
  }
}
