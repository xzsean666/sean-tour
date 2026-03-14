import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminSetSupportAgentInput {
  @Field()
  userId: string;

  @Field()
  enabled: boolean;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  note?: string;
}
