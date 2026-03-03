import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ServiceItem } from './service-item.dto';

@ObjectType()
export class ServicePage {
  @Field(() => [ServiceItem])
  items: ServiceItem[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field()
  hasMore: boolean;
}
