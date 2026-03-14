import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SetSupportConversationInternalNoteInput {
  @Field()
  conversationId: string;

  @Field({ nullable: true })
  internalNote?: string;
}
