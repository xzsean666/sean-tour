import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Notification } from './notification.dto';

@ObjectType()
export class NotificationPage {
  @Field(() => [Notification])
  items: Notification[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
