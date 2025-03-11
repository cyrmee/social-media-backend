import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AppConfigModule } from './config/config.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import * as passport from 'passport';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    AppConfigModule,
    RedisModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [RedisModule],
      inject: ['SESSION_MIDDLEWARE'],
      useFactory: (sessionMiddleware) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: {
          settings: {
            'request.credentials': 'include',
          },
        },
        context: ({ req, res }) => {
          return new Promise((resolve) =>
            sessionMiddleware(req, res, () => {
              if (req.session) {
                // Ensure session is properly set
                req.sessionID = req.session.id;
                // Initialize Passport after session is set
                passport.initialize()(req, res, () => {
                  passport.session()(req, res, () => {
                    resolve({ req, res });
                  });
                });
              } else {
                resolve({ req, res });
              }
            }),
          );
        },
        formatError: (error) => {
          const originalError = error.extensions?.originalError;

          // Create a clean error response without stack traces
          return {
            message: error.message,
            path: error.path,
            extensions: {
              code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
              ...(originalError &&
              typeof originalError === 'object' &&
              'message' in originalError
                ? {
                    originalError: {
                      message: originalError.message,
                      statusCode:
                        'statusCode' in originalError
                          ? originalError.statusCode
                          : undefined,
                      error:
                        'error' in originalError
                          ? originalError.error
                          : undefined,
                    },
                  }
                : {}),
            },
          };
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
