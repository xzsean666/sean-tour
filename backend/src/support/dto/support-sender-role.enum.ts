import { registerEnumType } from '@nestjs/graphql';

export enum SupportSenderRole {
  USER = 'USER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  SYSTEM = 'SYSTEM',
}

registerEnumType(SupportSenderRole, {
  name: 'SupportSenderRole',
});
