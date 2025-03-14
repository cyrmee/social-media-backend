import { PrismaClient, NotificationType, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      username: 'john_doe',
      name: 'John Doe',
      hash: await argon2.hash('password123', {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64MB
        timeCost: 3, // number of iterations
        parallelism: 1, // degree of parallelism
      }),
      bio: 'Hello, I am John!',
      isVerified: true,
      twoFactorEnabled: true,
      posts: {
        create: {
          content: 'Hello World! This is my first post.',
        },
      },
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      username: 'jane_doe',
      name: 'Jane Doe',
      hash: await argon2.hash('password123', {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      }),
      userRoles: [Role.ADMIN, Role.USER],
      bio: 'Hello, I am Jane!',
      isVerified: true,
      twoFactorEnabled: true,
      posts: {
        create: {
          content: 'Nice to meet everyone!',
        },
      },
    },
  });

  // Create some comments
  const post1 = await prisma.post.findFirst({ where: { authorId: user1.id } });

  if (!post1) {
    console.warn('No post found for user1, skipping comment creation.');
  } else {
    await prisma.comment.create({
      data: {
        content: 'Welcome to the platform!',
        postId: post1.id,
        authorId: user2.id,
      },
    });
  }

  // Create some likes
  if (!post1) {
    console.warn('No post found for user1, skipping like creation.');
  } else {
    await prisma.like.create({
      data: {
        postId: post1.id,
        userId: user2.id,
      },
    });
  }

  // Create a follow relationship
  await prisma.follow.create({
    data: {
      followerId: user2.id,
      followingId: user1.id,
    },
  });

  // Create a notification
  await prisma.notification.create({
    data: {
      type: NotificationType.FOLLOW,
      userId: user1.id,
      actorId: user2.id,
    },
  });

  // Create a mention
  if (post1) {
    await prisma.mention.create({
      data: {
        postId: post1.id,
        userId: user2.id,
      },
    });
  } else {
    console.warn('No post found for user1, skipping mention creation.');
  }

  console.log('Seed data created successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
