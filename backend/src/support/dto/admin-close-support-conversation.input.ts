import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminCloseSupportConversationInput {
  @Field()
  conversationId: string;

  @Field({ nullable: true })
  closeReason?: string;
}
