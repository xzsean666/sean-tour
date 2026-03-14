import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { UserProfileResolver } from './user.resolver';
import { UserProfileService } from './user.service';

@Module({
  imports: [AuthModule, NotificationModule],
  providers: [UserProfileResolver, UserProfileService],
  exports: [UserProfileService],
})
export class UserModule {}
