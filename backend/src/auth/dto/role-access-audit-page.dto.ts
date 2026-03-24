import { Field, Int, ObjectType } from '@nestjs/graphql';
import { RoleAccessAudit } from './role-access-audit.dto';

@ObjectType()
export class RoleAccessAuditPage {
  @Field(() => [RoleAccessAudit])
  items: RoleAccessAudit[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
