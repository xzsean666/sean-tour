import { registerEnumType } from '@nestjs/graphql';

export enum RoleAccessAuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

registerEnumType(RoleAccessAuditAction, {
  name: 'RoleAccessAuditAction',
});
