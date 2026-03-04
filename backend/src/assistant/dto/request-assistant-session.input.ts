import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RequestAssistantSessionInput {
  @Field()
  bookingId: string;

  @Field()
  topic: string;

  @Field()
  preferredContact: string;

  @Field(() => [String])
  preferredTimeSlots: string[];

  @Field({ nullable: true })
  language?: string;
}
