import { Field, ObjectType } from '@nestjs/graphql';
import { SupportConversationAuditAction } from './support-conversation-audit-action.enum';
import { SupportConversationPriority } from './support-conversation-priority.enum';
import { SupportConversationStatus } from './support-conversation-status.enum';

@ObjectType()
export class SupportConversationAudit {
  @Field()
  id: string;

  @Field()
  conversationId: string;

  @Field(() => SupportConversationAuditAction)
  action: SupportConversationAuditAction;

  @Field()
  actor: string;

  @Field()
  summary: string;

  @Field({ nullable: true })
  messagePreview?: string;

  @Field(() => SupportConversationPriority, { nullable: true })
  priority?: SupportConversationPriority;

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  assignedAgentId?: string;

  @Field({ nullable: true })
  closeReason?: string;

  @Field(() => SupportConversationStatus, { nullable: true })
  reopenedFromStatus?: SupportConversationStatus;

  @Field()
  createdAt: string;
}
