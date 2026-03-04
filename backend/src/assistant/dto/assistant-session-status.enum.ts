import { registerEnumType } from '@nestjs/graphql';

export enum AssistantSessionStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

registerEnumType(AssistantSessionStatus, {
  name: 'AssistantSessionStatus',
});
