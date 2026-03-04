import { Field, ObjectType } from '@nestjs/graphql';
import { ServiceAuditAction } from './service-audit-action.enum';

@ObjectType()
export class ServiceAuditLog {
  @Field()
  id: string;

  @Field()
  serviceId: string;

  @Field(() => ServiceAuditAction)
  action: ServiceAuditAction;

  @Field({ nullable: true })
  beforeStatus?: string;

  @Field({ nullable: true })
  afterStatus?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  actor: string;

  @Field()
  createdAt: string;
}
