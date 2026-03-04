import { Field, ObjectType } from '@nestjs/graphql';
import { BookingStatus } from '../../booking/dto/booking-status.enum';
import { OrderPaymentEvent } from './order-payment-event.dto';
import { OrderPaymentStatus } from './order-payment-status.enum';

@ObjectType()
export class Order {
  @Field()
  id: string;

  @Field()
  bookingId: string;

  @Field()
  serviceTitle: string;

  @Field()
  city: string;

  @Field(() => BookingStatus)
  bookingStatus: BookingStatus;

  @Field(() => OrderPaymentStatus)
  paymentStatus: OrderPaymentStatus;

  @Field()
  expectedAmount: string;

  @Field()
  createdAt: string;

  @Field(() => [OrderPaymentEvent])
  paymentEvents: OrderPaymentEvent[];
}
