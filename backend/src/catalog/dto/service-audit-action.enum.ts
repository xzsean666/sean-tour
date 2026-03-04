import { registerEnumType } from '@nestjs/graphql';

export enum ServiceAuditAction {
  UPSERT = 'UPSERT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  DELETE = 'DELETE',
}

registerEnumType(ServiceAuditAction, {
  name: 'ServiceAuditAction',
});
