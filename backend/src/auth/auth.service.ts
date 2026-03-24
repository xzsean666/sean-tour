import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminAccessService } from './admin-access.service';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';
import { SupabaseService } from './supabase.service';
import { AdminAccess } from './dto/admin-access.dto';
import { AdminSetAccessInput } from './dto/admin-set-access.input';
import { EmailAuthInput } from './dto/email-auth.input';
import { GoogleLoginInput } from './dto/google-login.input';
import { SupabaseTokenLoginInput } from './dto/supabase-token-login.input';
import { CurrentUserDto } from './dto/current-user.dto';
import { PageInput } from '../common/dto/page.input';
import { RoleAccessAuditPage } from './dto/role-access-audit-page.dto';
import { RoleAccessService } from './role-access.service';

@Injectable()
export class AuthService {
  constructor(
    private wechatService: WeChatService,
    private userService: UserService,
    private supabaseService: SupabaseService,
    private adminAccessService: AdminAccessService,
    private roleAccessService: RoleAccessService,
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

  async getCurrentUser(user: Record<string, unknown>): Promise<CurrentUserDto> {
    const userId = typeof user.user_id === 'string' ? user.user_id : '';
    const email = typeof user.email === 'string' ? user.email : undefined;
    const [isAdmin, isSupportAgent] = await Promise.all([
      this.adminAccessService.isAdminIdentity({
        userId,
        email,
      }),
      this.roleAccessService.isRoleGranted('SUPPORT_AGENT', {
        userId,
        email,
      }),
    ]);

    return {
      user_id: userId,
      user_account:
        typeof user.user_account === 'string' ? user.user_account : '',
      provider: typeof user.provider === 'string' ? user.provider : '',
      email,
      is_admin: isAdmin,
      is_support_agent: isSupportAgent,
    };
  }

  async listAdminAccessEntries(): Promise<AdminAccess[]> {
    return this.adminAccessService.listAdminAccessEntries();
  }

  async setAdminAccess(
    input: AdminSetAccessInput,
    actorUser: Record<string, unknown> | undefined,
  ): Promise<AdminAccess> {
    return this.adminAccessService.setAdminAccess(input, actorUser);
  }

  async listRoleAccessAuditLogs(
    role: 'ADMIN' | 'SUPPORT_AGENT',
    recordId?: string,
    page?: PageInput,
  ): Promise<RoleAccessAuditPage> {
    return this.adminAccessService.listRoleAccessAuditLogs(
      role,
      recordId,
      page,
    );
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
