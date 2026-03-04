import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaymentEvent } from './payment-event.dto';

@ObjectType()
export class PaymentEventPage {
  @Field(() => [PaymentEvent])
  items: PaymentEvent[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
