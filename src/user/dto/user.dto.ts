import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

/**
 * GraphQL and Swagger DTO for user data
 */
@ObjectType()
export class UserDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: 'b6e11e23-d43d-4a0d-a9d3-08e94d7a032b',
  })
  @Field(() => ID)
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @Field(() => String)
  name: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  @Field(() => String)
  email: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe123',
  })
  @Field(() => String)
  username: string;

  @ApiProperty({
    description: 'URL to user profile picture',
    example: 'https://example.com/images/profile.jpg',
  })
  @Field(() => String)
  profilePicture: string;

  @ApiProperty({
    description: 'User biography or about section',
    example: 'Software engineer passionate about web development',
  })
  @Field(() => String)
  bio: string;

  @ApiProperty({
    description: 'Whether the user has verified their account',
    example: true,
  })
  @Field(() => Boolean)
  isVerified: boolean;

  @ApiProperty({
    description: 'Date when the user account was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  @Field(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the user account was last updated',
    example: '2023-01-10T00:00:00.000Z',
  })
  @Field(() => Date)
  updatedAt: Date;

  @ApiProperty({
    description: 'Whether two-factor authentication is enabled',
    example: false,
  })
  @Field(() => Boolean)
  twoFactorEnabled: boolean;

  @ApiProperty({
    description: 'User roles',
    example: ['USER'],
    isArray: true,
  })
  @Field(() => [String])
  roles: string[];
}
