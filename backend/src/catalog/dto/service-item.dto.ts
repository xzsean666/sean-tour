import { Field, ObjectType } from '@nestjs/graphql';
import { PriceDto } from './price.dto';
import { ServiceCapacity } from './service-capacity.dto';
import { ServiceContact } from './service-contact.dto';
import { ServiceResource } from './service-resource.dto';
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
  images: string[];

  @Field(() => [String])
  languages: string[];

  @Field(() => PriceDto)
  basePrice: PriceDto;

  @Field({ nullable: true })
  cancellationPolicy?: string;

  @Field(() => [String])
  availableTimeSlots: string[];

  @Field(() => ServiceCapacity, { nullable: true })
  capacity?: ServiceCapacity;

  @Field(() => ServiceContact, { nullable: true })
  supportContact?: ServiceContact;

  @Field(() => [ServiceResource])
  resources: ServiceResource[];

  @Field({ nullable: true })
  voucherTemplate?: string;

  @Field()
  status: string;

  @Field()
  updatedAt: string;
}
