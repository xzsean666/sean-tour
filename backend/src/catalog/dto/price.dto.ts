import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PriceDto {
  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;
}
