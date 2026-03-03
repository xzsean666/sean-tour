import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { CreateUsdtPaymentInput } from './dto/create-usdt-payment.input';
import { PaymentIntent } from './dto/payment-intent.dto';
import { PaymentService } from './payment.service';

@Resolver()
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Mutation(() => PaymentIntent)
  @UseGuards(AuthGuard)
  createUsdtPayment(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: CreateUsdtPaymentInput,
  ): PaymentIntent {
    return this.paymentService.createUsdtPayment(
      this.extractUserId(user),
      input,
    );
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
