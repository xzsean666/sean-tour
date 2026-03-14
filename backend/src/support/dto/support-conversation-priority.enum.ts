import { registerEnumType } from '@nestjs/graphql';

export enum SupportConversationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

registerEnumType(SupportConversationPriority, {
  name: 'SupportConversationPriority',
});
