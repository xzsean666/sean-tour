import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminGuard, AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { PageInput } from '../common/dto/page.input';
import { AdminAssignSupportConversationInput } from './dto/admin-assign-support-conversation.input';
import { AdminCloseSupportConversationInput } from './dto/admin-close-support-conversation.input';
import { AdminSetSupportAgentInput } from './dto/admin-set-support-agent.input';
import { AdminUpsertSupportWorkspaceConfigInput } from './dto/admin-upsert-support-workspace-config.input';
import { ReplySupportConversationInput } from './dto/reply-support-conversation.input';
import { ResolveSupportConversationInput } from './dto/resolve-support-conversation.input';
import { SendSupportMessageInput } from './dto/send-support-message.input';
import { SetSupportConversationInternalNoteInput } from './dto/set-support-conversation-internal-note.input';
import { SetSupportConversationTriageInput } from './dto/set-support-conversation-triage.input';
import { SupportAgent } from './dto/support-agent.dto';
import { SupportConversationAuditAction } from './dto/support-conversation-audit-action.enum';
import { SupportConversationAuditPage } from './dto/support-conversation-audit-page.dto';
import { SupportConversationListInput } from './dto/support-conversation-list.input';
import { SupportConversationPage } from './dto/support-conversation-page.dto';
import { SupportConversation } from './dto/support-conversation.dto';
import { SupportConversationWorkspaceMeta } from './dto/support-conversation-workspace-meta.dto';
import { SupportIntakeConfig } from './dto/support-intake-config.dto';
import { SupportWorkspaceConfig } from './dto/support-workspace-config.dto';
import { SupportService } from './support.service';

@Resolver()
export class SupportResolver {
  constructor(private readonly supportService: SupportService) {}

  @Query(() => SupportConversation)
  @UseGuards(AuthGuard)
  async mySupportConversation(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<SupportConversation> {
    return this.supportService.getMySupportConversation(
      this.extractUserId(user),
    );
  }

  @Query(() => SupportIntakeConfig)
  @UseGuards(AuthGuard)
  async supportIntakeConfig(): Promise<SupportIntakeConfig> {
    return this.supportService.getSupportIntakeConfig();
  }

  @Mutation(() => SupportConversation)
  @UseGuards(AuthGuard)
  async sendSupportMessage(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: SendSupportMessageInput,
  ): Promise<SupportConversation> {
    return this.supportService.sendSupportMessage(
      this.extractUserId(user),
      input,
    );
  }

  @Query(() => SupportAgent)
  @UseGuards(AuthGuard)
  async mySupportAgentProfile(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<SupportAgent> {
    return this.supportService.getMySupportAgentProfile(
      this.extractUserId(user),
    );
  }

  @Mutation(() => SupportAgent)
  @UseGuards(AuthGuard)
  async setMySupportAgentActive(
    @CurrentUser() user: Record<string, unknown>,
    @Args('isActive') isActive: boolean,
  ): Promise<SupportAgent> {
    return this.supportService.setMySupportAgentActive(
      this.extractUserId(user),
      isActive,
    );
  }

  @Query(() => SupportConversationPage)
  @UseGuards(AuthGuard)
  async supportConversationQueue(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input', { nullable: true }) input?: SupportConversationListInput,
  ): Promise<SupportConversationPage> {
    return this.supportService.listSupportConversationsForAgent(
      this.extractUserId(user),
      input,
    );
  }

  @Query(() => SupportConversation)
  @UseGuards(AuthGuard)
  async supportConversationDetail(
    @CurrentUser() user: Record<string, unknown>,
    @Args('conversationId') conversationId: string,
  ): Promise<SupportConversation> {
    return this.supportService.getSupportConversationDetailForAgent(
      this.extractUserId(user),
      conversationId,
    );
  }

  @Mutation(() => SupportConversation)
  @UseGuards(AuthGuard)
  async replySupportConversation(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: ReplySupportConversationInput,
  ): Promise<SupportConversation> {
    return this.supportService.replySupportConversation(
      this.extractUserId(user),
      input,
    );
  }

  @Mutation(() => SupportConversation)
  @UseGuards(AuthGuard)
  async resolveSupportConversation(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: ResolveSupportConversationInput,
  ): Promise<SupportConversation> {
    return this.supportService.resolveSupportConversation(user, input);
  }

  @Query(() => SupportWorkspaceConfig)
  @UseGuards(AuthGuard)
  async supportWorkspaceConfig(
    @CurrentUser() user: Record<string, unknown>,
  ): Promise<SupportWorkspaceConfig> {
    return this.supportService.getSupportWorkspaceConfig(user);
  }

  @Query(() => SupportConversationWorkspaceMeta)
  @UseGuards(AuthGuard)
  async supportConversationWorkspaceMeta(
    @CurrentUser() user: Record<string, unknown>,
    @Args('conversationId') conversationId: string,
  ): Promise<SupportConversationWorkspaceMeta> {
    return this.supportService.getSupportConversationWorkspaceMeta(
      user,
      conversationId,
    );
  }

  @Query(() => [SupportConversationWorkspaceMeta])
  @UseGuards(AuthGuard)
  async supportConversationWorkspaceMetas(
    @CurrentUser() user: Record<string, unknown>,
    @Args({ name: 'conversationIds', type: () => [String] })
    conversationIds: string[],
  ): Promise<SupportConversationWorkspaceMeta[]> {
    return this.supportService.getSupportConversationWorkspaceMetas(
      user,
      conversationIds,
    );
  }

  @Query(() => SupportConversationAuditPage)
  @UseGuards(AuthGuard)
  async supportConversationAuditLogs(
    @CurrentUser() user: Record<string, unknown>,
    @Args('conversationId') conversationId: string,
    @Args('actor', { nullable: true }) actor?: string,
    @Args('action', {
      nullable: true,
      type: () => SupportConversationAuditAction,
    })
    action?: SupportConversationAuditAction,
    @Args('page', { nullable: true }) page?: PageInput,
  ): Promise<SupportConversationAuditPage> {
    return this.supportService.getSupportConversationAuditLogs(
      user,
      conversationId,
      {
        actor,
        action,
        page,
      },
    );
  }

  @Mutation(() => SupportConversationWorkspaceMeta)
  @UseGuards(AuthGuard)
  async setSupportConversationInternalNote(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: SetSupportConversationInternalNoteInput,
  ): Promise<SupportConversationWorkspaceMeta> {
    return this.supportService.setSupportConversationInternalNote(user, input);
  }

  @Mutation(() => SupportConversationWorkspaceMeta)
  @UseGuards(AuthGuard)
  async setSupportConversationTriage(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: SetSupportConversationTriageInput,
  ): Promise<SupportConversationWorkspaceMeta> {
    return this.supportService.setSupportConversationTriage(user, input);
  }

  @Query(() => SupportConversationPage)
  @UseGuards(AdminGuard)
  async adminSupportConversations(
    @Args('input', { nullable: true }) input?: SupportConversationListInput,
  ): Promise<SupportConversationPage> {
    return this.supportService.adminListSupportConversations(input);
  }

  @Query(() => SupportConversation)
  @UseGuards(AdminGuard)
  async adminSupportConversation(
    @Args('conversationId') conversationId: string,
  ): Promise<SupportConversation> {
    return this.supportService.adminGetSupportConversation(conversationId);
  }

  @Query(() => [SupportAgent])
  @UseGuards(AdminGuard)
  async adminSupportAgents(): Promise<SupportAgent[]> {
    return this.supportService.adminListSupportAgents();
  }

  @Mutation(() => SupportAgent)
  @UseGuards(AdminGuard)
  async adminSetSupportAgent(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: AdminSetSupportAgentInput,
  ): Promise<SupportAgent> {
    return this.supportService.adminSetSupportAgent(input, user);
  }

  @Mutation(() => SupportConversation)
  @UseGuards(AdminGuard)
  async adminAssignSupportConversation(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: AdminAssignSupportConversationInput,
  ): Promise<SupportConversation> {
    return this.supportService.adminAssignSupportConversation(input, user);
  }

  @Mutation(() => SupportConversation)
  @UseGuards(AdminGuard)
  async adminCloseSupportConversation(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: AdminCloseSupportConversationInput,
  ): Promise<SupportConversation> {
    return this.supportService.adminCloseSupportConversation(input, user);
  }

  @Mutation(() => SupportWorkspaceConfig)
  @UseGuards(AdminGuard)
  async adminUpsertSupportWorkspaceConfig(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: AdminUpsertSupportWorkspaceConfigInput,
  ): Promise<SupportWorkspaceConfig> {
    return this.supportService.adminUpsertSupportWorkspaceConfig(input, user);
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
