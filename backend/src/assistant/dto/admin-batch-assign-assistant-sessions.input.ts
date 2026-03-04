import { Field, InputType } from '@nestjs/graphql';
import { AssistantSessionStatus } from './assistant-session-status.enum';

@InputType()
export class AdminBatchAssignAssistantSessionsInput {
  @Field(() => [String])
  sessionIds: string[];

  @Field()
  assignedAgent: string;

  @Field(() => AssistantSessionStatus, { nullable: true })
  status?: AssistantSessionStatus;

  @Field({ nullable: true })
  internalNote?: string;
}
