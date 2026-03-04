import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class DeleteServiceInput {
  @Field()
  id: string;

  @Field({ defaultValue: false })
  hardDelete: boolean = false;
}
