import { Field, InputType } from '@nestjs/graphql';
import { BookingStatus } from './booking-status.enum';

@InputType()
export class UpdateBookingStatusInput {
  @Field()
  bookingId: string;

  @Field(() => BookingStatus)
  status: BookingStatus;

  @Field({ nullable: true })
  reason?: string;
}
