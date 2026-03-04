import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaymentEventSource } from '../../payment/dto/payment-event-source.enum';
import { PaymentStatus } from '../../payment/dto/payment-status.enum';

@ObjectType()
export class OrderPaymentEvent {
  @Field()
  eventId: string;

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
  createdAt: string;
}
