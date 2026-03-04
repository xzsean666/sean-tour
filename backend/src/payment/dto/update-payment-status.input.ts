import { Field, InputType, Int } from '@nestjs/graphql';
import { PaymentStatus } from './payment-status.enum';

@InputType()
export class UpdatePaymentStatusInput {
  @Field({ nullable: true })
  paymentId?: string;

  @Field({ nullable: true })
  bookingId?: string;

  @Field(() => PaymentStatus, { nullable: true })
  status?: PaymentStatus;

  @Field({ nullable: true })
  paidAmount?: string;

  @Field({ nullable: true })
  txHash?: string;

  @Field(() => Int, { nullable: true })
  confirmations?: number;
}
