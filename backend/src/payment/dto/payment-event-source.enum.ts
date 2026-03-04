import { registerEnumType } from '@nestjs/graphql';

export enum PaymentEventSource {
  ADMIN = 'ADMIN',
  CALLBACK = 'CALLBACK',
  SYNC = 'SYNC',
}

registerEnumType(PaymentEventSource, {
  name: 'PaymentEventSource',
});
