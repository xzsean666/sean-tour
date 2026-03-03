import { registerEnumType } from '@nestjs/graphql';

export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CONFIRMED = 'CONFIRMED',
  IN_SERVICE = 'IN_SERVICE',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  REFUNDING = 'REFUNDING',
  REFUNDED = 'REFUNDED',
}

registerEnumType(BookingStatus, {
  name: 'BookingStatus',
});
