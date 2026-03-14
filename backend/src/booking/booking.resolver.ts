import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminGuard, AuthGuard, CurrentUser } from '../auth/auth.guard.service';
import { ServiceResource } from '../catalog/dto/service-resource.dto';
import { BookingService } from './booking.service';
import { Booking } from './dto/booking.dto';
import { BookingListInput } from './dto/booking-list.input';
import { BookingPage } from './dto/booking-page.dto';
import { CreateBookingInput } from './dto/create-booking.input';
import { ReassignBookingResourceInput } from './dto/reassign-booking-resource.input';
import { ServiceResourceSchedule } from './dto/service-resource-schedule.dto';
import { UpdateBookingStatusInput } from './dto/update-booking-status.input';

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

  @Query(() => [ServiceResource])
  @UseGuards(AdminGuard)
  async adminAssignableBookingResources(
    @Args('bookingId') bookingId: string,
  ): Promise<ServiceResource[]> {
    return this.bookingService.listAssignableResourcesByAdmin(bookingId);
  }

  @Query(() => ServiceResourceSchedule)
  @UseGuards(AdminGuard)
  async adminServiceResourceSchedule(
    @Args('serviceId') serviceId: string,
    @Args('date', { nullable: true }) date?: string,
  ): Promise<ServiceResourceSchedule> {
    return this.bookingService.getServiceResourceScheduleByAdmin(
      serviceId,
      date,
    );
  }

  @Mutation(() => Booking)
  @UseGuards(AdminGuard)
  async adminUpdateBookingStatus(
    @Args('input') input: UpdateBookingStatusInput,
  ): Promise<Booking> {
    return this.bookingService.updateBookingStatusByAdmin(input);
  }

  @Mutation(() => Booking)
  @UseGuards(AdminGuard)
  async adminReassignBookingResource(
    @Args('input') input: ReassignBookingResourceInput,
  ): Promise<Booking> {
    return this.bookingService.reassignBookingResourceByAdmin(input);
  }

  private extractUserId(user: Record<string, unknown>): string {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    return userId;
  }
}
