import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { UpsertUserProfileInput } from './dto/upsert-user-profile.input';
import { UserDataExport } from './dto/user-data-export.dto';
import { UserProfile } from './dto/user-profile.dto';
import { UserProfileService } from './user.service';

@Resolver()
export class UserProfileResolver {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Query(() => UserProfile)
  @UseGuards(AuthGuard)
  async myProfile(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<UserProfile> {
    return this.userProfileService.getMyProfile(this.extractIdentity(user));
  }

  @Mutation(() => UserProfile)
  @UseGuards(AuthGuard)
  async upsertMyProfile(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: UpsertUserProfileInput,
  ): Promise<UserProfile> {
    return this.userProfileService.upsertMyProfile(
      this.extractIdentity(user),
      input,
    );
  }

  @Query(() => UserDataExport)
  @UseGuards(AuthGuard)
  async exportMyData(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<UserDataExport> {
    return this.userProfileService.exportMyData(this.extractIdentity(user));
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async deleteMyData(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<boolean> {
    return this.userProfileService.deleteMyData(
      this.extractIdentity(user).userId,
    );
  }

  private extractIdentity(user: Record<string, unknown>): {
    userId: string;
    email?: string;
  } {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return {
      userId,
      email: typeof user?.email === 'string' ? user.email : undefined,
    };
  }
}
