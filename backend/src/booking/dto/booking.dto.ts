import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { PriceDto } from '../../catalog/dto/price.dto';
import { ServiceType } from '../../catalog/dto/service-type.enum';
import { BookingStatus } from './booking-status.enum';

@ObjectType()
export class BookingServiceContact {
  @Field()
  name: string;

  @Field()
  channel: string;

  @Field()
  value: string;
}

@ObjectType()
export class BookingAssignedResource {
  @Field()
  id: string;

  @Field()
  label: string;
}

@ObjectType()
export class BookingServiceSnapshot {
  @Field()
  title: string;

  @Field()
  city: string;

  @Field(() => PriceDto)
  basePrice: PriceDto;

  @Field({ nullable: true })
  cancellationPolicy?: string;

  @Field(() => BookingServiceContact, { nullable: true })
  supportContact?: BookingServiceContact;

  @Field({ nullable: true })
  voucherTemplate?: string;
}

@ObjectType()
export class Booking {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  serviceId: string;

  @Field(() => ServiceType)
  serviceType: ServiceType;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field({ nullable: true })
  timeSlot?: string;

  @Field(() => Int)
  travelerCount: number;

  @Field(() => BookingAssignedResource, { nullable: true })
  assignedResource?: BookingAssignedResource;

  @Field(() => BookingStatus)
  status: BookingStatus;

  @Field({ nullable: true })
  cancelReason?: string;

  @Field(() => BookingServiceSnapshot)
  serviceSnapshot: BookingServiceSnapshot;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
