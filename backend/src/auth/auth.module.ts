import { Global, Module } from '@nestjs/common';
import { AdminAccessService } from './admin-access.service';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';
import { AdminGuard, AuthGuard } from './auth.guard.service';
import { RoleAccessService } from './role-access.service';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [
    AdminAccessService,
    AuthResolver,
    AuthService,
    WeChatService,
    UserService,
    RoleAccessService,
    AuthGuard,
    AdminGuard,
    SupabaseService,
  ],
  exports: [AdminAccessService, RoleAccessService, AuthGuard, AdminGuard],
})
export class AuthModule {}
