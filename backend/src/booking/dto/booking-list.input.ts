import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { BookingStatus } from './booking-status.enum';

@InputType()
export class BookingListInput {
  @Field(() => BookingStatus, { nullable: true })
  status?: BookingStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
