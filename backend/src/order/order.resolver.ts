import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { OrderListInput } from './dto/order-list.input';
import { OrderPage } from './dto/order-page.dto';
import { Order } from './dto/order.dto';
import { OrderService } from './order.service';

@Resolver()
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => OrderPage)
  @UseGuards(AuthGuard)
  async myOrders(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input', { nullable: true }) input?: OrderListInput,
  ): Promise<OrderPage> {
    return this.orderService.myOrders(this.extractUserId(user), input);
  }

  @Query(() => Order)
  @UseGuards(AuthGuard)
  async orderDetail(
    @CurrentUser() user: Record<string, unknown>,
    @Args('orderId') orderId: string,
  ): Promise<Order> {
    return this.orderService.orderDetail(this.extractUserId(user), orderId);
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
