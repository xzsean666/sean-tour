import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ServiceContact {
  @Field()
  name: string;

  @Field()
  channel: string;

  @Field()
  value: string;
}
