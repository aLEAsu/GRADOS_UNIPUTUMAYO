import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { GoogleOAuthConfig } from '../../../config/app.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const googleConfig = configService.get<GoogleOAuthConfig>('google');

    if (!googleConfig?.clientId || !googleConfig?.clientSecret) {
      // Log warning but don't crash — Google OAuth is optional
      new Logger(GoogleStrategy.name).warn(
        'Google OAuth credentials not configured. Google login will be unavailable.',
      );
    }

    super({
      clientID: googleConfig?.clientId || 'not-configured',
      clientSecret: googleConfig?.clientSecret || 'not-configured',
      callbackURL: googleConfig?.callbackUrl || 'http://localhost:4000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      displayName: string;
      name?: { givenName?: string; familyName?: string };
      emails?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const user = await this.authService.validateGoogleUser(profile);
      done(null, user);
    } catch (error) {
      this.logger.error(`Google OAuth validation failed: ${(error as Error).message}`);
      done(error as Error, false);
    }
  }
}
