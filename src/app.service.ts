import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      name: 'Social Media API',
      version: '1.0.0',
      status: 'online',
      documentation: {
        swagger: '/api/docs',
        graphql: '/graphql',
      },
      description:
        'A feature-rich social media backend API built with NestJS, PostgreSQL, Prisma ORM, and Redis',
      features: [
        'Session-based authentication with Redis storage',
        'Two-factor Authentication (TOTP)',
        'Role-based access control',
        'User management',
        'Social features (posts, comments, likes, follows)',
        'REST and GraphQL API support',
      ],
    };
  }
}
