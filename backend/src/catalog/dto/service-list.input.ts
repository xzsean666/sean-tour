import { Field, InputType } from '@nestjs/graphql';
import { PageInput } from '../../common/dto/page.input';
import { ServiceType } from './service-type.enum';

@InputType()
export class ServiceListInput {
  @Field(() => ServiceType, { nullable: true })
  type?: ServiceType;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  language?: string;

  @Field(() => PageInput, { nullable: true })
  page?: PageInput;
}
