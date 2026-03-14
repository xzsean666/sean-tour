import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SupportConversation } from './support-conversation.dto';

@ObjectType()
export class SupportConversationPage {
  @Field(() => [SupportConversation])
  items: SupportConversation[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
