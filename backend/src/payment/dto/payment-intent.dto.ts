import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaymentStatus } from './payment-status.enum';

@ObjectType()
export class PaymentIntent {
  @Field()
  id: string;

  @Field()
  bookingId: string;

  @Field()
  userId: string;

  @Field()
  token: string;

  @Field()
  network: string;

  @Field()
  tokenStandard: string;

  @Field()
  expectedAmount: string;

  @Field()
  paidAmount: string;

  @Field()
  payAddress: string;

  @Field({ nullable: true })
  txHash?: string;

  @Field(() => Int)
  confirmations: number;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field()
  expiredAt: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
