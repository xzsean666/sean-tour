import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SupportConversationStatus } from './support-conversation-status.enum';
import { SupportMessage } from './support-message.dto';

@ObjectType()
export class SupportConversation {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  assignedAgentId?: string;

  @Field(() => [String])
  sharedAgentIds: string[];

  @Field(() => SupportConversationStatus)
  status: SupportConversationStatus;

  @Field({ nullable: true })
  lastMessagePreview?: string;

  @Field({ nullable: true })
  lastMessageAt?: string;

  @Field(() => Int)
  unreadForUser: number;

  @Field(() => Int)
  unreadForAgents: number;

  @Field(() => [SupportMessage])
  messages: SupportMessage[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
