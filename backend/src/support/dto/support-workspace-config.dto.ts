import { Field, ObjectType } from '@nestjs/graphql';
import { SupportWorkspaceTemplate } from './support-workspace-template.dto';

@ObjectType()
export class SupportWorkspaceConfig {
  @Field(() => [SupportWorkspaceTemplate])
  issueStarters: SupportWorkspaceTemplate[];

  @Field(() => [SupportWorkspaceTemplate])
  quickReplyTemplates: SupportWorkspaceTemplate[];

  @Field(() => [String])
  commonTags: string[];

  @Field({ nullable: true })
  updatedAt?: string;

  @Field({ nullable: true })
  updatedBy?: string;
}
