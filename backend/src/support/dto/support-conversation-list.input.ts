import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { SupportConversationPriority } from './support-conversation-priority.enum';
import { SupportConversationStatus } from './support-conversation-status.enum';

@InputType()
export class SupportConversationListInput {
  @Field({ nullable: true })
  conversationId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  assignedAgentId?: string;

  @Field(() => SupportConversationStatus, { nullable: true })
  status?: SupportConversationStatus;

  @Field({ nullable: true })
  onlyMine?: boolean;

  @Field({ nullable: true })
  unassignedOnly?: boolean;

  @Field({ nullable: true })
  hasUnreadForUser?: boolean;

  @Field({ nullable: true })
  hasUnreadForAgents?: boolean;

  @Field(() => SupportConversationPriority, { nullable: true })
  priority?: SupportConversationPriority;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
