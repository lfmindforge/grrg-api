import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

// Passport appelle validate() après vérification du token Google.
// La valeur passée à done() est injectée dans req.user par le controller.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email provided by Google'), false);

    try {
      const tokens = await this.authService.findOrCreateOAuthUser({
        provider: 'google',
        oauthId: profile.id,
        email,
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });
      done(null, tokens);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
