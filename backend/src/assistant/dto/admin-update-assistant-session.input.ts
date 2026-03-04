import { Field, InputType } from '@nestjs/graphql';
import { AssistantSessionStatus } from './assistant-session-status.enum';

@InputType()
export class AdminUpdateAssistantSessionInput {
  @Field()
  sessionId: string;

  @Field(() => AssistantSessionStatus)
  status: AssistantSessionStatus;

  @Field({ nullable: true })
  assignedAgent?: string;

  @Field({ nullable: true })
  internalNote?: string;
}
