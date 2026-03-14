import { Field, ObjectType } from '@nestjs/graphql';
import { SupportConversationPriority } from './support-conversation-priority.enum';
import { SupportConversationSlaStatus } from './support-conversation-sla-status.enum';

@ObjectType()
export class SupportConversationWorkspaceMeta {
  @Field()
  conversationId: string;

  @Field({ nullable: true })
  internalNote?: string;

  @Field(() => SupportConversationPriority)
  priority: SupportConversationPriority;

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  closeReason?: string;

  @Field({ nullable: true })
  closedAt?: string;

  @Field({ nullable: true })
  closedBy?: string;

  @Field()
  updatedAt: string;

  @Field({ nullable: true })
  updatedBy?: string;

  @Field({ nullable: true })
  slaDueAt?: string;

  @Field(() => SupportConversationSlaStatus, { nullable: true })
  slaStatus?: SupportConversationSlaStatus;
}
