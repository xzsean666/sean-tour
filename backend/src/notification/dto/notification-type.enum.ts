import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  BOOKING = 'BOOKING',
  PAYMENT = 'PAYMENT',
  ASSISTANT = 'ASSISTANT',
  PROFILE = 'PROFILE',
  SYSTEM = 'SYSTEM',
}

registerEnumType(NotificationType, {
  name: 'NotificationType',
});
