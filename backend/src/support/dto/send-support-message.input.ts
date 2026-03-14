import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SendSupportMessageInput {
  @Field()
  content: string;
}
