import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ReassignBookingResourceInput {
  @Field()
  bookingId: string;

  @Field()
  resourceId: string;
}
