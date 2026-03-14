import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ReplySupportConversationInput {
  @Field()
  conversationId: string;

  @Field()
  content: string;
}
