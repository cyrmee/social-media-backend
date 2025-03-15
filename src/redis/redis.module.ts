import { Module, OnApplicationShutdown } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import * as session from 'express-session';
import * as redis from 'connect-redis';
import { createClient } from '@redis/client';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            reconnectStrategy: (retries: number) => {
              if (retries > 10) {
                console.error('Max reconnection attempts reached. Giving up.');
                return new Error('Max reconnection attempts reached');
              }
              // Exponential backoff: 2^retries * 100ms
              return Math.min(2 ** retries * 100, 3000);
            },
          },
          password: configService.get('REDIS_PASSWORD'),
          tls: process.env.NODE_ENV === 'production' ? {} : undefined,
          ttl: configService.get<number>(
            'SESSION_EXPIRY_SECONDS',
            60 * 60 * 24 * 3,
          ),
        }),
      }),
      isGlobal: true,
    }),
  ],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const redisClient = createClient({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                console.error('Max reconnection attempts reached. Giving up.');
                return new Error('Max reconnection attempts reached');
              }
              // Exponential backoff: 2^retries * 100ms
              return Math.min(2 ** retries * 100, 3000);
            },
          },
          password: configService.get('REDIS_PASSWORD'),
        });

        // Handle connection errors
        redisClient.on('error', (err) => {
          console.error('Redis connection error:', err);
        });

        // Log successful reconnection
        redisClient.on('reconnecting', () => {
          console.log('Attempting to reconnect to Redis...');
        });

        redisClient.on('ready', () => {
          console.log('Redis client successfully connected');
        });

        try {
          await redisClient.connect();
        } catch (err) {
          console.error('Failed to establish initial Redis connection:', err);
          // The reconnection strategy will handle retries
        }

        return redisClient;
      },
      inject: [ConfigService],
    },
    {
      provide: 'SESSION_MIDDLEWARE',
      useFactory: async (redisClient: any, configService: ConfigService) => {
        const store = new redis.RedisStore({
          client: redisClient,
        });

        return session({
          store,
          secret: configService.get('SESSION_SECRET')!,
          name: 'sessionId',
          resave: false,
          saveUninitialized: true,
          rolling: true,
          proxy: true,
          cookie: {
            httpOnly: true,
            secure:
              configService.get('NODE_ENV') === 'production' ? true : false,
            sameSite:
              configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
            path: '/',
          },
        });
      },
      inject: ['REDIS_CLIENT', ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT', 'SESSION_MIDDLEWARE', CacheModule],
})
export class RedisModule {}
