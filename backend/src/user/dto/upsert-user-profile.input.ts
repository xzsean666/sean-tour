import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpsertUserProfileInput {
  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  passportNumber?: string;

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
}
