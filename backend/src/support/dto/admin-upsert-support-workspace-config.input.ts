import { Field, InputType } from '@nestjs/graphql';
import { SupportWorkspaceTemplateInput } from './support-workspace-template.input';

@InputType()
export class AdminUpsertSupportWorkspaceConfigInput {
  @Field(() => [SupportWorkspaceTemplateInput])
  issueStarters: SupportWorkspaceTemplateInput[];

  @Field(() => [SupportWorkspaceTemplateInput])
  quickReplyTemplates: SupportWorkspaceTemplateInput[];

  @Field(() => [String])
  commonTags: string[];
}
