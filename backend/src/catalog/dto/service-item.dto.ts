import { Field, ObjectType } from '@nestjs/graphql';
import { PriceDto } from './price.dto';
import { ServiceType } from './service-type.enum';

@ObjectType()
export class ServiceItem {
  @Field()
  id: string;

  @Field(() => ServiceType)
  type: ServiceType;

  @Field()
  title: string;

  @Field()
  city: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  coverImage?: string;

  @Field(() => [String])
  languages: string[];

  @Field(() => PriceDto)
  basePrice: PriceDto;

  @Field()
  status: string;

  @Field()
  updatedAt: string;
}
