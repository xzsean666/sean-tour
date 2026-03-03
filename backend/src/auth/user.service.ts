import { Injectable } from '@nestjs/common';
import { JWTHelper } from '../helpers/utils/encodeUtils/jwtHelper';
import { config } from '../config';
import { createHash } from 'crypto';
import { LoginResult } from './dto/login-result.dto';

type AuthIdentity = {
  provider: string;
  providerUserId: string;
  email?: string;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
};

@Injectable()
export class UserService {
  private jwtHelper: JWTHelper;

  constructor() {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  issueToken(identity: AuthIdentity): LoginResult {
    const user_account = `${identity.provider}_${identity.providerUserId}`;
    const user_id = this.hashUserId(user_account);
    const token = this.jwtHelper.generateToken(
      {
        user_id,
        user_account,
        provider: identity.provider,
        provider_user_id: identity.providerUserId,
        email: identity.email,
      },
      config.auth.JWT_EXPIRES_IN,
    );

    return {
      token,
      user_id,
      provider: identity.provider,
      provider_user_id: identity.providerUserId,
      email: identity.email,
      supabase_access_token: identity.supabaseAccessToken,
      supabase_refresh_token: identity.supabaseRefreshToken,
    };
  }

  private hashUserId(userAccount: string): string {
    return createHash('sha256').update(userAccount).digest('hex').slice(0, 32);
  }
}
