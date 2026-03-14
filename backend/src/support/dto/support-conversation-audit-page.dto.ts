import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SupportConversationAudit } from './support-conversation-audit.dto';

@ObjectType()
export class SupportConversationAuditPage {
  @Field(() => [SupportConversationAudit])
  items: SupportConversationAudit[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
