import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserDataExport {
  @Field()
  userId: string;

  @Field()
  exportedAt: string;

  @Field()
  payloadJson: string;
}
