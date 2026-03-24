import { registerEnumType } from '@nestjs/graphql';

export enum PaymentEventSource {
  ADMIN = 'ADMIN',
  CALLBACK = 'CALLBACK',
  SYNC = 'SYNC',
  SYSTEM = 'SYSTEM',
}

registerEnumType(PaymentEventSource, {
  name: 'PaymentEventSource',
});
