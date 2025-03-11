import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookies: string[];
  let userCookies: string[];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Clean the database
    await prisma.user.deleteMany({});

    // Create an admin user and a regular user
    const password = await argon2.hash('Password123!');

    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        username: 'admin',
        name: 'Admin User',
        hash: password,
        userRoles: [Role.ADMIN],
      },
    });

    const user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        username: 'user',
        name: 'Regular User',
        hash: password,
        userRoles: [Role.USER],
      },
    });

    // Login as admin and store cookies
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Password123!',
      });
    adminCookies = Array.isArray(adminLogin.headers['set-cookie'])
      ? adminLogin.headers['set-cookie']
      : [adminLogin.headers['set-cookie']];

    // Login as regular user and store cookies
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'Password123!',
      });
    userCookies = Array.isArray(userLogin.headers['set-cookie'])
      ? userLogin.headers['set-cookie']
      : [userLogin.headers['set-cookie']];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await app.close();
  });

  describe('REST Endpoints', () => {
    describe('GET /user/profile', () => {
      it('should get own profile when authenticated', () => {
        return request(app.getHttpServer())
          .get('/user/profile')
          .set('Cookie', userCookies)
          .expect(200)
          .expect((res) => {
            expect(res.body.email).toBe('user@example.com');
            expect(res.body.username).toBe('user');
            expect(res.body.roles).toContain(Role.USER);
          });
      });

      it('should return 401 when not authenticated', () => {
        return request(app.getHttpServer()).get('/user/profile').expect(401);
      });
    });

    describe('GET /user/list', () => {
      it('should allow admin to list all users', () => {
        return request(app.getHttpServer())
          .get('/user/list')
          .set('Cookie', adminCookies)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
            expect(res.body.some((u) => u.email === 'admin@example.com')).toBe(
              true,
            );
            expect(res.body.some((u) => u.email === 'user@example.com')).toBe(
              true,
            );
          });
      });

      it('should deny access to regular users', () => {
        return request(app.getHttpServer())
          .get('/user/list')
          .set('Cookie', userCookies)
          .expect(403);
      });
    });
  });

  describe('GraphQL Endpoints', () => {
    const profileQuery = `
      query {
        profile {
          id
          email
          username
          name
          roles
          profilePicture
          bio
          isVerified
          twoFactorEnabled
        }
      }
    `;

    const usersQuery = `
      query {
        users {
          id
          email
          username
          name
          roles
        }
      }
    `;

    it('should fetch profile through GraphQL', () => {
      return request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', userCookies)
        .send({
          query: profileQuery,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.profile).toBeDefined();
          expect(res.body.data.profile.email).toBe('user@example.com');
          expect(res.body.data.profile.username).toBe('user');
        });
    });

    it('should allow admin to fetch all users through GraphQL', () => {
      return request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', adminCookies)
        .send({
          query: usersQuery,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.users).toBeDefined();
          expect(Array.isArray(res.body.data.users)).toBe(true);
          expect(res.body.data.users.length).toBe(2);
        });
    });

    it('should deny users list to non-admin through GraphQL', () => {
      return request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', userCookies)
        .send({
          query: usersQuery,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.errors).toBeDefined();
          expect(res.body.errors[0].message).toContain('Forbidden');
        });
    });
  });
});
