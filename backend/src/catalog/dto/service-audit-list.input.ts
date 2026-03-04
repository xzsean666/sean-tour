import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { ServiceAuditAction } from './service-audit-action.enum';

@InputType()
export class ServiceAuditListInput {
  @Field({ nullable: true })
  serviceId?: string;

  @Field(() => ServiceAuditAction, { nullable: true })
  action?: ServiceAuditAction;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
