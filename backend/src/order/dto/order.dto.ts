import { Field, ObjectType } from '@nestjs/graphql';
import { BookingStatus } from '../../booking/dto/booking-status.enum';
import { OrderContact } from './order-contact.dto';
import { OrderPaymentEvent } from './order-payment-event.dto';
import { OrderPaymentStatus } from './order-payment-status.enum';

@ObjectType()
export class Order {
  @Field()
  id: string;

  @Field()
  bookingId: string;

  @Field()
  serviceId: string;

  @Field()
  userId: string;

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
  startDate: string;

  @Field()
  endDate: string;

  @Field({ nullable: true })
  timeSlot?: string;

  @Field({ nullable: true })
  assignedResourceId?: string;

  @Field({ nullable: true })
  assignedResourceLabel?: string;

  @Field({ nullable: true })
  cancellationPolicy?: string;

  @Field(() => OrderContact, { nullable: true })
  supportContact?: OrderContact;

  @Field({ nullable: true })
  serviceVoucherCode?: string;

  @Field({ nullable: true })
  serviceVoucherInstructions?: string;

  @Field()
  createdAt: string;

  @Field(() => [OrderPaymentEvent])
  paymentEvents: OrderPaymentEvent[];
}
