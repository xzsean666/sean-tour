import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { BookingStatus } from '../../booking/dto/booking-status.enum';
import { OrderPaymentStatus } from './order-payment-status.enum';

@InputType()
export class OrderListInput {
  @Field(() => BookingStatus, { nullable: true })
  bookingStatus?: BookingStatus;

  @Field({ nullable: true })
  bookingId?: string;

  @Field({ nullable: true })
  serviceId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field(() => OrderPaymentStatus, { nullable: true })
  paymentStatus?: OrderPaymentStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
