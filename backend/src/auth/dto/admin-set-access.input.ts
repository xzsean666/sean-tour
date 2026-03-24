import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminSetAccessInput {
  @Field({ nullable: true })
  recordId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  enabled: boolean;
}
