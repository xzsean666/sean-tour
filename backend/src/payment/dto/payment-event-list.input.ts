import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { PaymentEventSource } from './payment-event-source.enum';
import { PaymentStatus } from './payment-status.enum';

@InputType()
export class PaymentEventListInput {
  @Field({ nullable: true })
  eventId?: string;

  @Field({ nullable: true })
  paymentId?: string;

  @Field({ nullable: true })
  bookingId?: string;

  @Field({ nullable: true })
  actor?: string;

  @Field({ nullable: true })
  replayOfEventId?: string;

  @Field(() => PaymentEventSource, { nullable: true })
  source?: PaymentEventSource;

  @Field(() => PaymentStatus, { nullable: true })
  status?: PaymentStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
