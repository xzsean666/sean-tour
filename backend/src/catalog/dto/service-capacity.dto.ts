import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ServiceCapacity {
  @Field(() => Int)
  min: number;

  @Field(() => Int)
  max: number;

  @Field(() => Int)
  remaining: number;
}
