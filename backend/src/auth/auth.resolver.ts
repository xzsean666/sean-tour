import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UseGuards } from '@nestjs/common';
import { AdminGuard, AuthGuard, CurrentUser } from './auth.guard.service';
import { AdminAccess } from './dto/admin-access.dto';
import { AdminSetAccessInput } from './dto/admin-set-access.input';
import { LoginResult } from './dto/login-result.dto';
import { EmailAuthInput } from './dto/email-auth.input';
import { GoogleLoginInput } from './dto/google-login.input';
import { SupabaseTokenLoginInput } from './dto/supabase-token-login.input';
import { CurrentUserDto } from './dto/current-user.dto';
import { PageInput } from '../common/dto/page.input';
import { RoleAccessAuditPage } from './dto/role-access-audit-page.dto';
import { RoleAccessRoleEnum } from './dto/role-access-role.enum';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => LoginResult)
  registerWithEmail(@Args('input') input: EmailAuthInput) {
    return this.authService.registerWithEmail(input);
  }

  @Mutation(() => LoginResult)
  loginWithEmail(@Args('input') input: EmailAuthInput) {
    return this.authService.loginWithEmail(input);
  }

  @Mutation(() => LoginResult)
  loginWithGoogle(@Args('input') input: GoogleLoginInput) {
    return this.authService.loginWithGoogle(input);
  }

  @Mutation(() => LoginResult)
  loginWithSupabaseToken(@Args('input') input: SupabaseTokenLoginInput) {
    return this.authService.loginWithSupabaseToken(input);
  }

  @Mutation(() => LoginResult)
  loginWithWechat(@Args('code') code: string) {
    return this.authService.wechatLogin(code);
  }

  @Query(() => CurrentUserDto)
  @UseGuards(AuthGuard)
  async currentUser(@CurrentUser() user: Record<string, unknown>) {
    return this.authService.getCurrentUser(user);
  }

  @Query(() => [AdminAccess])
  @UseGuards(AdminGuard)
  async adminAccessEntries(): Promise<AdminAccess[]> {
    return this.authService.listAdminAccessEntries();
  }

  @Mutation(() => AdminAccess)
  @UseGuards(AdminGuard)
  async adminSetAccess(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: AdminSetAccessInput,
  ): Promise<AdminAccess> {
    return this.authService.setAdminAccess(input, user);
  }

  @Query(() => RoleAccessAuditPage)
  @UseGuards(AdminGuard)
  async adminRoleAccessAuditLogs(
    @Args('role', { type: () => RoleAccessRoleEnum }) role: RoleAccessRoleEnum,
    @Args('recordId', { nullable: true }) recordId?: string,
    @Args('page', { nullable: true }) page?: PageInput,
  ): Promise<RoleAccessAuditPage> {
    return this.authService.listRoleAccessAuditLogs(role, recordId, page);
  }
}
