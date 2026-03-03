import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class LoginResult {
  @Field()
  token: string;

  @Field()
  user_id: string;

  @Field()
  provider: string;

  @Field()
  provider_user_id: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  supabase_access_token?: string;

  @Field({ nullable: true })
  supabase_refresh_token?: string;
}
