import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SupabaseTokenLoginInput {
  @Field()
  access_token: string;
}
