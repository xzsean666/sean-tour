import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { ServiceResourceInput } from './service-resource.dto';
import { ServiceType } from './service-type.enum';

@InputType()
export class ServiceCapacityInput {
  @Field(() => Int)
  min: number;

  @Field(() => Int)
  max: number;

  @Field(() => Int)
  remaining: number;
}

@InputType()
export class ServiceContactInput {
  @Field()
  name: string;

  @Field()
  channel: string;

  @Field()
  value: string;
}

@InputType()
export class PackageServiceDetailInput {
  @Field(() => Int)
  durationDays: number;

  @Field(() => [String])
  itinerary: string[];
}

@InputType()
export class GuideServiceDetailInput {
  @Field(() => [String])
  languages: string[];

  @Field(() => Int)
  yearsOfExperience: number;

  @Field(() => [String])
  certifications: string[];
}

@InputType()
export class CarServiceDetailInput {
  @Field(() => Int)
  seats: number;

  @Field()
  carType: string;

  @Field({ nullable: true })
  luggageCapacity?: string;
}

@InputType()
export class AssistantServiceDetailInput {
  @Field(() => [String])
  supportChannels: string[];

  @Field()
  serviceHours: string;
}

@InputType()
export class UpsertServiceInput {
  @Field({ nullable: true })
  id?: string;

  @Field(() => ServiceType)
  type: ServiceType;

  @Field()
  title: string;

  @Field()
  city: string;

  @Field()
  description: string;

  @Field(() => [String], { nullable: true })
  images?: string[];

  @Field(() => [String])
  languages: string[];

  @Field(() => Float)
  basePriceAmount: number;

  @Field({ nullable: true })
  cancellationPolicy?: string;

  @Field(() => [String], { nullable: true })
  availableTimeSlots?: string[];

  @Field(() => ServiceCapacityInput, { nullable: true })
  capacity?: ServiceCapacityInput;

  @Field(() => ServiceContactInput, { nullable: true })
  supportContact?: ServiceContactInput;

  @Field(() => [ServiceResourceInput], { nullable: true })
  resources?: ServiceResourceInput[];

  @Field({ nullable: true })
  voucherTemplate?: string;

  @Field({ nullable: true })
  status?: string;

  @Field(() => PackageServiceDetailInput, { nullable: true })
  packageDetail?: PackageServiceDetailInput;

  @Field(() => GuideServiceDetailInput, { nullable: true })
  guideDetail?: GuideServiceDetailInput;

  @Field(() => CarServiceDetailInput, { nullable: true })
  carDetail?: CarServiceDetailInput;

  @Field(() => AssistantServiceDetailInput, { nullable: true })
  assistantDetail?: AssistantServiceDetailInput;
}
