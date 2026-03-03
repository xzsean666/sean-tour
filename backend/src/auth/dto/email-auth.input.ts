import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EmailAuthInput {
  @Field()
  email: string;

  @Field()
  password: string;
}
