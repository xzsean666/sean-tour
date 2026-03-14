import { Field, ObjectType } from '@nestjs/graphql';
import { SupportSenderRole } from './support-sender-role.enum';

@ObjectType()
export class SupportMessage {
  @Field()
  id: string;

  @Field()
  conversationId: string;

  @Field()
  userId: string;

  @Field()
  senderUserId: string;

  @Field(() => SupportSenderRole)
  senderRole: SupportSenderRole;

  @Field()
  content: string;

  @Field()
  createdAt: string;
}
