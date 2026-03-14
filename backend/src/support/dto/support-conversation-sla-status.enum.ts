import { registerEnumType } from '@nestjs/graphql';

export enum SupportConversationSlaStatus {
  ON_TRACK = 'ON_TRACK',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
}

registerEnumType(SupportConversationSlaStatus, {
  name: 'SupportConversationSlaStatus',
});
