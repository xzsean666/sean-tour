import { registerEnumType } from '@nestjs/graphql';

export enum SupportConversationStatus {
  WAITING_AGENT = 'WAITING_AGENT',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_USER = 'WAITING_USER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

registerEnumType(SupportConversationStatus, {
  name: 'SupportConversationStatus',
});
