import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private authService: AuthService) {
    super();
  }

  serializeUser(user: any, done: Function) {
    done(null, user.id);
  }

  async deserializeUser(payload: any, done: Function) {
    // We only need the user ID here as we'll use the session ID
    // from the cookie to get the complete user from Redis
    done(null, payload);
  }
}
