import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clean the database before each test
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await app.close();
  });

  describe('Authentication', () => {
    it('/auth/register (POST) - should register a new user', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(registerData.email);
      expect(response.body.username).toBe(registerData.username);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('hash');
    });

    it('/auth/login (POST) - should login and return user data', async () => {
      // First create a user
      const password = 'Password123!';
      const hash = await argon2.hash(password);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          hash,
          userRoles: [Role.USER],
        },
      });

      // Then try to login
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.requires2FA).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('/auth/logout (POST) - should logout successfully', async () => {
      // First login to get a session
      const password = 'Password123!';
      const hash = await argon2.hash(password);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          hash,
          userRoles: [Role.USER],
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Then logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      // Verify session is invalidated by trying to access protected route
      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Cookie', cookies)
        .expect(401);
    });
  });

  describe('2FA Flow', () => {
    let cookies: string[];
    let userId: string;

    beforeEach(async () => {
      // Create a user and login
      const password = 'Password123!';
      const hash = await argon2.hash(password);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          hash,
          userRoles: [Role.USER],
        },
      });
      userId = user.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      cookies = Array.isArray(loginResponse.headers['set-cookie'])
        ? loginResponse.headers['set-cookie']
        : [loginResponse.headers['set-cookie']];
    });

    it('should complete 2FA setup flow', async () => {
      // Generate 2FA secret
      const generateResponse = await request(app.getHttpServer())
        .post('/auth/2fa/generate')
        .set('Cookie', cookies)
        .expect(200);

      expect(generateResponse.body).toHaveProperty('secret');
      expect(generateResponse.body).toHaveProperty('qrCodeDataURL');

      // Enable 2FA (in a real scenario, user would scan QR code and provide correct code)
      // For test purposes, we'll mock the verification
      await request(app.getHttpServer())
        .post('/auth/2fa/enable')
        .set('Cookie', cookies)
        .send({
          twoFactorCode: '123456', // This would be a valid code in real scenario
        })
        .expect(200);

      // Verify 2FA is enabled for user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user).not.toBeNull();
      expect(user!.twoFactorEnabled).toBe(true);
    });
  });
});
