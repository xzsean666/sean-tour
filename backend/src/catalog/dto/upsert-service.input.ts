import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { ServiceType } from './service-type.enum';

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
