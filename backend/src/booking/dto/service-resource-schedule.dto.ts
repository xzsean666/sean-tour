import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BookingStatus } from './booking-status.enum';

@ObjectType()
export class ServiceResourceScheduleBooking {
  @Field()
  bookingId: string;

  @Field()
  userId: string;

  @Field(() => BookingStatus)
  bookingStatus: BookingStatus;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field({ nullable: true })
  timeSlot?: string;

  @Field(() => Int)
  travelerCount: number;

  @Field({ nullable: true })
  assignedResourceId?: string;

  @Field({ nullable: true })
  assignedResourceLabel?: string;
}

@ObjectType()
export class ServiceResourceScheduleItem {
  @Field()
  resourceId: string;

  @Field()
  resourceLabel: string;

  @Field()
  status: string;

  @Field(() => [String])
  languages: string[];

  @Field(() => Int, { nullable: true })
  seats?: number;

  @Field(() => [String])
  availableTimeSlots: string[];

  @Field(() => [ServiceResourceScheduleBooking])
  bookings: ServiceResourceScheduleBooking[];

  @Field(() => [String])
  conflictTimeSlots: string[];
}

@ObjectType()
export class ServiceResourceSchedule {
  @Field()
  serviceId: string;

  @Field()
  serviceTitle: string;

  @Field(() => [ServiceResourceScheduleItem])
  resources: ServiceResourceScheduleItem[];

  @Field(() => [ServiceResourceScheduleBooking])
  unassignedBookings: ServiceResourceScheduleBooking[];
}
