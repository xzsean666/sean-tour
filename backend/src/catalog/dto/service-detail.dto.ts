import { Field, Int, ObjectType, createUnionType } from '@nestjs/graphql';

@ObjectType()
export class PackageServiceDetail {
  @Field(() => Int)
  durationDays: number;

  @Field(() => [String])
  itinerary: string[];
}

@ObjectType()
export class GuideServiceDetail {
  @Field(() => [String])
  languages: string[];

  @Field(() => Int)
  yearsOfExperience: number;

  @Field(() => [String])
  certifications: string[];
}

@ObjectType()
export class CarServiceDetail {
  @Field(() => Int)
  seats: number;

  @Field()
  carType: string;

  @Field({ nullable: true })
  luggageCapacity?: string;
}

@ObjectType()
export class AssistantServiceDetail {
  @Field(() => [String])
  supportChannels: string[];

  @Field()
  serviceHours: string;
}

export const ServiceDetailUnion = createUnionType({
  name: 'ServiceDetail',
  types: () =>
    [
      PackageServiceDetail,
      GuideServiceDetail,
      CarServiceDetail,
      AssistantServiceDetail,
    ] as const,
  resolveType(value: { __typename?: string }) {
    switch (value.__typename) {
      case 'PackageServiceDetail':
        return PackageServiceDetail;
      case 'GuideServiceDetail':
        return GuideServiceDetail;
      case 'CarServiceDetail':
        return CarServiceDetail;
      case 'AssistantServiceDetail':
        return AssistantServiceDetail;
      default:
        return null;
    }
  },
});
