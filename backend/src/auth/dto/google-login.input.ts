import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GoogleLoginInput {
  @Field()
  id_token: string;
}
