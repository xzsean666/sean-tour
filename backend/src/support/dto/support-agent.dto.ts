import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SupportAgent {
  @Field()
  userId: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  enabled: boolean;

  @Field()
  isActive: boolean;

  @Field(() => Int)
  openConversationCount: number;

  @Field({ nullable: true })
  lastAssignedAt?: string;

  @Field({ nullable: true })
  grantedBy?: string;

  @Field({ nullable: true })
  updatedBy?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
