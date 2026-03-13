import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrderContact {
  @Field()
  name: string;

  @Field()
  channel: string;

  @Field()
  value: string;
}
