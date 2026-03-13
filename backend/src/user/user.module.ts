import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { UserProfileResolver } from './user.resolver';
import { UserProfileService } from './user.service';

@Module({
  imports: [NotificationModule],
  providers: [UserProfileResolver, UserProfileService],
  exports: [UserProfileService],
})
export class UserModule {}
