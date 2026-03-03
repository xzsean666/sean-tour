import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateBookingInput {
  @Field()
  serviceId: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field(() => Int)
  travelerCount: number;
}
