import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { AssistantSessionStatus } from './assistant-session-status.enum';

@InputType()
export class AssistantSessionListInput {
  @Field({ nullable: true })
  bookingId?: string;

  @Field(() => AssistantSessionStatus, { nullable: true })
  status?: AssistantSessionStatus;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
