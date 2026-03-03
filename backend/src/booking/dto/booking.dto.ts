import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { PriceDto } from '../../catalog/dto/price.dto';
import { ServiceType } from '../../catalog/dto/service-type.enum';
import { BookingStatus } from './booking-status.enum';

@ObjectType()
export class BookingServiceSnapshot {
  @Field()
  title: string;

  @Field(() => PriceDto)
  basePrice: PriceDto;
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

  @Field(() => Int)
  travelerCount: number;

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
