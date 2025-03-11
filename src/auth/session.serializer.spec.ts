import { Test, TestingModule } from '@nestjs/testing';
import { SessionSerializer } from './session.serializer';
import { AuthService } from './auth.service';

describe('SessionSerializer', () => {
  let serializer: SessionSerializer;
  let authService: AuthService;

  const mockAuthService = {
    getUserFromSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionSerializer,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    serializer = module.get<SessionSerializer>(SessionSerializer);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('serializeUser', () => {
    it('should serialize user to their ID', (done) => {
      const user = {
        id: '123',
        email: 'test@example.com',
        username: 'testuser',
      };

      serializer.serializeUser(user, (err: Error, userId: string) => {
        expect(err).toBeNull();
        expect(userId).toBe('123');
        done();
      });
    });

    it('should handle undefined user gracefully', (done) => {
      const user = undefined;

      serializer.serializeUser(user, (err: Error, userId: string) => {
        // When user is undefined, we should get an error
        expect(err).toBeInstanceOf(Error);
        expect(userId).toBeUndefined();
        done();
      });
    });
  });

  describe('deserializeUser', () => {
    it('should pass through the user ID', (done) => {
      const userId = '123';

      serializer.deserializeUser(userId, (err: Error, result: string) => {
        expect(err).toBeNull();
        expect(result).toBe(userId);
        done();
      });
    });

    it('should handle undefined payload gracefully', (done) => {
      const payload = undefined;

      serializer.deserializeUser(payload, (err: Error, result: any) => {
        // When payload is undefined, we should get an error
        expect(err).toBeInstanceOf(Error);
        expect(result).toBeUndefined();
        done();
      });
    });
  });
});
