import { Field, InputType } from '@nestjs/graphql';
import { SupportConversationPriority } from './support-conversation-priority.enum';

@InputType()
export class SetSupportConversationTriageInput {
  @Field()
  conversationId: string;

  @Field(() => SupportConversationPriority, { nullable: true })
  priority?: SupportConversationPriority;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}
