import { registerEnumType } from '@nestjs/graphql';

export enum OrderPaymentStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  UNDERPAID = 'UNDERPAID',
  EXPIRED = 'EXPIRED',
  REFUNDING = 'REFUNDING',
  REFUNDED = 'REFUNDED',
}

registerEnumType(OrderPaymentStatus, {
  name: 'OrderPaymentStatus',
});
