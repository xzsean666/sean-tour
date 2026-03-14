import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminAssignSupportConversationInput {
  @Field()
  conversationId: string;

  @Field()
  agentUserId: string;
}
