import { registerEnumType } from '@nestjs/graphql';

export enum ServiceType {
  PACKAGE = 'PACKAGE',
  GUIDE = 'GUIDE',
  CAR = 'CAR',
  ASSISTANT = 'ASSISTANT',
}

registerEnumType(ServiceType, {
  name: 'ServiceType',
});
