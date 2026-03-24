import { Field, ObjectType } from '@nestjs/graphql';
import { RoleAccessAuditAction } from './role-access-audit-action.enum';
import { RoleAccessRoleEnum } from './role-access-role.enum';

@ObjectType()
export class RoleAccessAudit {
  @Field()
  id: string;

  @Field(() => RoleAccessRoleEnum)
  role: RoleAccessRoleEnum;

  @Field()
  recordId: string;

  @Field(() => RoleAccessAuditAction)
  action: RoleAccessAuditAction;

  @Field()
  actor: string;

  @Field()
  summary: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  enabled: boolean;

  @Field({ nullable: true })
  previousEnabled?: boolean;

  @Field()
  createdAt: string;
}
