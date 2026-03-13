import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ServiceResource {
  @Field()
  id: string;

  @Field()
  label: string;

  @Field()
  status: string;

  @Field(() => [String])
  languages: string[];

  @Field(() => Int, { nullable: true })
  seats?: number;

  @Field(() => [String])
  availableTimeSlots: string[];
}

@InputType()
export class ServiceResourceInput {
  @Field()
  id: string;

  @Field()
  label: string;

  @Field({ nullable: true })
  status?: string;

  @Field(() => [String], { nullable: true })
  languages?: string[];

  @Field(() => Int, { nullable: true })
  seats?: number;

  @Field(() => [String], { nullable: true })
  availableTimeSlots?: string[];
}
