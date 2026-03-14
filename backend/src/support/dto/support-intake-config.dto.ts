import { Field, ObjectType } from '@nestjs/graphql';
import { SupportWorkspaceTemplate } from './support-workspace-template.dto';

@ObjectType()
export class SupportIntakeConfig {
  @Field(() => [SupportWorkspaceTemplate])
  issueStarters: SupportWorkspaceTemplate[];
}
