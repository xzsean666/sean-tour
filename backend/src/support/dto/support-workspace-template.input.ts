import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SupportWorkspaceTemplateInput {
  @Field()
  label: string;

  @Field()
  content: string;
}
