import { Field, ObjectType } from '@nestjs/graphql';
import { AssistantSessionStatus } from './assistant-session-status.enum';

@ObjectType()
export class AssistantSession {
  @Field()
  id: string;

  @Field()
  bookingId: string;

  @Field()
  userId: string;

  @Field()
  serviceId: string;

  @Field()
  serviceTitle: string;

  @Field()
  city: string;

  @Field()
  language: string;

  @Field()
  topic: string;

  @Field()
  preferredContact: string;

  @Field(() => [String])
  preferredTimeSlots: string[];

  @Field(() => AssistantSessionStatus)
  status: AssistantSessionStatus;

  @Field({ nullable: true })
  assignedAgent?: string;

  @Field({ nullable: true })
  internalNote?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
