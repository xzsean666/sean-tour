import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminAccess {
  @Field()
  id: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  source: string;

  @Field()
  enabled: boolean;

  @Field()
  editable: boolean;

  @Field({ nullable: true })
  grantedBy?: string;

  @Field({ nullable: true })
  updatedBy?: string;

  @Field({ nullable: true })
  createdAt?: string;

  @Field({ nullable: true })
  updatedAt?: string;
}
