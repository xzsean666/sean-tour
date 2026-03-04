import { registerEnumType } from '@nestjs/graphql';

export enum OrderPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
}

registerEnumType(OrderPaymentStatus, {
  name: 'OrderPaymentStatus',
});
