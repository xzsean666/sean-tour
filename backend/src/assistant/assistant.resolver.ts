import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CheckAdmin, CurrentUser } from '../auth/auth.guard.service';
import { AssistantService } from './assistant.service';
import { AdminAssistantSessionListInput } from './dto/admin-assistant-session-list.input';
import { AdminUpdateAssistantSessionInput } from './dto/admin-update-assistant-session.input';
import { AssistantSessionListInput } from './dto/assistant-session-list.input';
import { AssistantSessionPage } from './dto/assistant-session-page.dto';
import { AssistantSession } from './dto/assistant-session.dto';
import { RequestAssistantSessionInput } from './dto/request-assistant-session.input';

@Resolver()
export class AssistantResolver {
  constructor(private readonly assistantService: AssistantService) {}

  @Mutation(() => AssistantSession)
  @UseGuards(AuthGuard)
  async requestAssistantSession(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: RequestAssistantSessionInput,
  ): Promise<AssistantSession> {
    return this.assistantService.requestAssistantSession(
      this.extractUserId(user),
      input,
    );
  }

  @Query(() => AssistantSessionPage)
  @UseGuards(AuthGuard)
  async myAssistantSessions(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input', { nullable: true }) input?: AssistantSessionListInput,
  ): Promise<AssistantSessionPage> {
    return this.assistantService.listMyAssistantSessions(
      this.extractUserId(user),
      input,
    );
  }

  @Query(() => AssistantSession)
  @UseGuards(AuthGuard)
  async assistantSessionDetail(
    @CurrentUser() user: Record<string, unknown>,
    @Args('sessionId') sessionId: string,
  ): Promise<AssistantSession> {
    return this.assistantService.getAssistantSessionDetailForUser(
      this.extractUserId(user),
      sessionId,
    );
  }

  @Query(() => AssistantSessionPage)
  async adminAssistantSessions(
    @CheckAdmin() _: boolean,
    @Args('input', { nullable: true }) input?: AdminAssistantSessionListInput,
  ): Promise<AssistantSessionPage> {
    return this.assistantService.adminListAssistantSessions(input);
  }

  @Mutation(() => AssistantSession)
  async adminUpdateAssistantSession(
    @CheckAdmin() _: boolean,
    @Args('input') input: AdminUpdateAssistantSessionInput,
  ): Promise<AssistantSession> {
    return this.assistantService.adminUpdateAssistantSession(input);
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
