import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { BookingService } from './booking.service';
import { Booking } from './dto/booking.dto';
import { BookingListInput } from './dto/booking-list.input';
import { BookingPage } from './dto/booking-page.dto';
import { CreateBookingInput } from './dto/create-booking.input';

@Resolver()
export class BookingResolver {
  constructor(private readonly bookingService: BookingService) {}

  @Mutation(() => Booking)
  @UseGuards(AuthGuard)
  async createBooking(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input') input: CreateBookingInput,
  ): Promise<Booking> {
    return this.bookingService.createBooking(this.extractUserId(user), input);
  }

  @Mutation(() => Booking)
  @UseGuards(AuthGuard)
  async cancelBooking(
    @CurrentUser() user: Record<string, unknown>,
    @Args('bookingId') bookingId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<Booking> {
    return this.bookingService.cancelBooking(
      this.extractUserId(user),
      bookingId,
      reason,
    );
  }

  @Query(() => BookingPage)
  @UseGuards(AuthGuard)
  async myBookings(
    @CurrentUser() user: Record<string, unknown>,
    @Args('input', { nullable: true }) input?: BookingListInput,
  ): Promise<BookingPage> {
    return this.bookingService.listMyBookings(this.extractUserId(user), input);
  }

  @Query(() => Booking)
  @UseGuards(AuthGuard)
  async bookingDetail(
    @CurrentUser() user: Record<string, unknown>,
    @Args('bookingId') bookingId: string,
  ): Promise<Booking> {
    return this.bookingService.getBookingByIdForUser(
      this.extractUserId(user),
      bookingId,
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
