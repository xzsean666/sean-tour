import { BadRequestException, Injectable } from '@nestjs/common';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';
import { SupabaseService } from './supabase.service';
import { EmailAuthInput } from './dto/email-auth.input';
import { GoogleLoginInput } from './dto/google-login.input';
import { SupabaseTokenLoginInput } from './dto/supabase-token-login.input';
import { CurrentUserDto } from './dto/current-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private wechatService: WeChatService,
    private userService: UserService,
    private supabaseService: SupabaseService,
  ) {}

  async registerWithEmail(input: EmailAuthInput) {
    this.assertEmailAndPassword(input.email, input.password);
    const user = await this.supabaseService.registerWithEmail(
      input.email,
      input.password,
    );

    return this.userService.issueToken({
      provider: 'supabase',
      providerUserId: user.id,
      email: user.email,
      supabaseAccessToken: user.accessToken,
      supabaseRefreshToken: user.refreshToken,
    });
  }

  async loginWithEmail(input: EmailAuthInput) {
    this.assertEmailAndPassword(input.email, input.password);
    const user = await this.supabaseService.loginWithEmail(
      input.email,
      input.password,
    );

    return this.userService.issueToken({
      provider: 'supabase',
      providerUserId: user.id,
      email: user.email,
      supabaseAccessToken: user.accessToken,
      supabaseRefreshToken: user.refreshToken,
    });
  }

  async loginWithGoogle(input: GoogleLoginInput) {
    if (!input.id_token?.trim()) {
      throw new BadRequestException('Google id_token is required');
    }

    const user = await this.supabaseService.loginWithGoogleIdToken(
      input.id_token,
    );
    return this.userService.issueToken({
      provider: 'supabase',
      providerUserId: user.id,
      email: user.email,
      supabaseAccessToken: user.accessToken,
      supabaseRefreshToken: user.refreshToken,
    });
  }

  async loginWithSupabaseToken(input: SupabaseTokenLoginInput) {
    if (!input.access_token?.trim()) {
      throw new BadRequestException('Supabase access_token is required');
    }

    const user = await this.supabaseService.verifyToken(input.access_token);
    return this.userService.issueToken({
      provider: 'supabase',
      providerUserId: user.id,
      email: user.email,
      supabaseAccessToken: input.access_token,
      supabaseRefreshToken: user.refreshToken,
    });
  }

  async wechatLogin(code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('WeChat code is required');
    }

    const wechatResult = await this.wechatService.verifyToken(code);
    if (!wechatResult?.user_id) {
      throw new BadRequestException('Unable to resolve WeChat user');
    }

    return this.userService.issueToken({
      provider: 'wechat',
      providerUserId: wechatResult.user_id,
    });
  }

  getCurrentUser(user: Record<string, unknown>): CurrentUserDto {
    return {
      user_id: typeof user.user_id === 'string' ? user.user_id : '',
      user_account: typeof user.user_account === 'string' ? user.user_account : '',
      provider: typeof user.provider === 'string' ? user.provider : '',
      email: typeof user.email === 'string' ? user.email : undefined,
    };
  }

  private assertEmailAndPassword(email?: string, password?: string) {
    if (!email?.trim()) {
      throw new BadRequestException('Email is required');
    }
    if (!password?.trim()) {
      throw new BadRequestException('Password is required');
    }
    if (password.length < 6) {
      throw new BadRequestException('Password length must be at least 6');
    }
  }
}
