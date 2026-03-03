import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateUsdtPaymentInput {
  @Field()
  bookingId: string;
}
