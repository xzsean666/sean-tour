import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ResolveSupportConversationInput {
  @Field()
  conversationId: string;
}
