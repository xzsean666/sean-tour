import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Booking } from './booking.dto';

@ObjectType()
export class BookingPage {
  @Field(() => [Booking])
  items: Booking[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
