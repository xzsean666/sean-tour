import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Order } from './order.dto';

@ObjectType()
export class OrderPage {
  @Field(() => [Order])
  items: Order[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
