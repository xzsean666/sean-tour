import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ServiceAuditLog } from './service-audit-log.dto';

@ObjectType()
export class ServiceAuditPage {
  @Field(() => [ServiceAuditLog])
  items: ServiceAuditLog[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
