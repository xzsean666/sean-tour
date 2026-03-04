import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AssistantSession } from './assistant-session.dto';

@ObjectType()
export class AssistantSessionPage {
  @Field(() => [AssistantSession])
  items: AssistantSession[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
