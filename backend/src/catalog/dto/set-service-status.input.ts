import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SetServiceStatusInput {
  @Field()
  id: string;

  @Field()
  status: string;
}
