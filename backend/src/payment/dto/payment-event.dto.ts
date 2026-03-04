import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaymentEventSource } from './payment-event-source.enum';
import { PaymentStatus } from './payment-status.enum';

@ObjectType()
export class PaymentEvent {
  @Field()
  eventId: string;

  @Field()
  paymentId: string;

  @Field()
  bookingId: string;

  @Field(() => PaymentEventSource)
  source: PaymentEventSource;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field()
  paidAmount: string;

  @Field({ nullable: true })
  txHash?: string;

  @Field(() => Int)
  confirmations: number;

  @Field()
  actor: string;

  @Field({ nullable: true })
  replayOfEventId?: string;

  @Field()
  createdAt: string;
}
