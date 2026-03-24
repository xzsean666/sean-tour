import { registerEnumType } from '@nestjs/graphql';

export enum RoleAccessRoleEnum {
  ADMIN = 'ADMIN',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
}

registerEnumType(RoleAccessRoleEnum, {
  name: 'RoleAccessRole',
});
