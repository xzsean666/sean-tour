import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { NotificationType } from './notification-type.enum';

@InputType()
export class NotificationListInput {
  @Field(() => NotificationType, { nullable: true })
  type?: NotificationType;

  @Field({ nullable: true })
  unreadOnly?: boolean;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
