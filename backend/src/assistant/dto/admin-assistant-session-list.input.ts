import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { AssistantSessionStatus } from './assistant-session-status.enum';

@InputType()
export class AdminAssistantSessionListInput {
  @Field({ nullable: true })
  sessionId?: string;

  @Field({ nullable: true })
  bookingId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field(() => AssistantSessionStatus, { nullable: true })
  status?: AssistantSessionStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
