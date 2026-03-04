import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { BookingStatus } from '../../booking/dto/booking-status.enum';

@InputType()
export class OrderListInput {
  @Field(() => BookingStatus, { nullable: true })
  bookingStatus?: BookingStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
