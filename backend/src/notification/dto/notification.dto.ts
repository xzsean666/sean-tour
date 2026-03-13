import { Field, ObjectType } from '@nestjs/graphql';
import { NotificationType } from './notification-type.enum';

@ObjectType()
export class Notification {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => NotificationType)
  type: NotificationType;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field({ nullable: true })
  targetPath?: string;

  @Field({ nullable: true })
  readAt?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
