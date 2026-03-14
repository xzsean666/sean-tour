import { registerEnumType } from '@nestjs/graphql';

export enum SupportConversationAuditAction {
  USER_MESSAGE = 'USER_MESSAGE',
  AGENT_REPLY = 'AGENT_REPLY',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  RESOLVED = 'RESOLVED',
  INTERNAL_NOTE_UPDATED = 'INTERNAL_NOTE_UPDATED',
  TRIAGE_UPDATED = 'TRIAGE_UPDATED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

registerEnumType(SupportConversationAuditAction, {
  name: 'SupportConversationAuditAction',
});
