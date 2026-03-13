import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { Notification } from './dto/notification.dto';
import { NotificationListInput } from './dto/notification-list.input';
import { NotificationPage } from './dto/notification-page.dto';
import { NotificationService } from './notification.service';

@Resolver()
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Query(() => NotificationPage)
  @UseGuards(AuthGuard)
  async myNotifications(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input', { nullable: true }) input?: NotificationListInput,
  ): Promise<NotificationPage> {
    return this.notificationService.listMyNotifications(
      this.extractUserId(user),
      input,
    );
  }

  @Mutation(() => Notification)
  @UseGuards(AuthGuard)
  async markNotificationRead(
    @CurrentUser() user: Record<string, unknown>,
    @Args('notificationId') notificationId: string,
  ): Promise<Notification> {
    return this.notificationService.markNotificationRead(
      this.extractUserId(user),
      notificationId,
    );
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
