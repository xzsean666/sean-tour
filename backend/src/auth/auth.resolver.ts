import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from './auth.guard.service';
import { LoginResult } from './dto/login-result.dto';
import { EmailAuthInput } from './dto/email-auth.input';
import { GoogleLoginInput } from './dto/google-login.input';
import { SupabaseTokenLoginInput } from './dto/supabase-token-login.input';
import { CurrentUserDto } from './dto/current-user.dto';

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
  currentUser(@CurrentUser() user: Record<string, unknown>) {
    return this.authService.getCurrentUser(user);
  }
}
