import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from '../auth.service';

// Passport appelle validate() après vérification du token GitHub.
// La valeur passée à done() est injectée dans req.user par le controller.
@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: Function,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email provided by GitHub'), false);

    try {
      const tokens = await this.authService.findOrCreateOAuthUser({
        provider: 'github',
        oauthId: String(profile.id),
        email,
        displayName: profile.displayName || (profile as any).username || 'user',
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });
      done(null, tokens);
    } catch (err) {
      done(err, false);
    }
  }
}
