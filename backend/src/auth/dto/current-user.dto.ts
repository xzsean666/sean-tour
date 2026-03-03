import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CurrentUserDto {
  @Field()
  user_id: string;

  @Field()
  user_account: string;

  @Field()
  provider: string;

  @Field({ nullable: true })
  email?: string;
}
