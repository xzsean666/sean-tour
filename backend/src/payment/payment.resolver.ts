import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CheckAdmin, CurrentUser } from '../auth/auth.guard.service';
import { CreateUsdtPaymentInput } from './dto/create-usdt-payment.input';
import { PaymentIntent } from './dto/payment-intent.dto';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import { PaymentService } from './payment.service';

@Resolver()
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Mutation(() => PaymentIntent)
  @UseGuards(AuthGuard)
  async createUsdtPayment(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: CreateUsdtPaymentInput,
  ): Promise<PaymentIntent> {
    return this.paymentService.createUsdtPayment(
      this.extractUserId(user),
      input,
    );
  }

  @Query(() => PaymentIntent, { nullable: true })
  @UseGuards(AuthGuard)
  async paymentByBooking(
    @CurrentUser() user: Record<string, unknown>,
    @Args('bookingId') bookingId: string,
  ): Promise<PaymentIntent | null> {
    return this.paymentService.getPaymentByBooking(
      this.extractUserId(user),
      bookingId,
    );
  }

  @Mutation(() => PaymentIntent)
  async adminUpdatePaymentStatus(
    @CheckAdmin() _: boolean,
    @Args('input') input: UpdatePaymentStatusInput,
  ): Promise<PaymentIntent> {
    return this.paymentService.updatePaymentStatus(input);
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
