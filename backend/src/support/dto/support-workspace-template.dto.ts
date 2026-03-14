import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SupportWorkspaceTemplate {
  @Field()
  label: string;

  @Field()
  content: string;
}
