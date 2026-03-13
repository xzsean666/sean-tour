import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserProfile {
  @Field()
  userId: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  passportNumber?: string;

  @Field({ nullable: true })
  passportNumberMasked?: string;

  @Field({ nullable: true })
  passportCountry?: string;

  @Field({ nullable: true })
  emergencyContactName?: string;

  @Field({ nullable: true })
  emergencyContactPhone?: string;

  @Field({ nullable: true })
  preferredLanguage?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
