import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { NotificationModule } from '../notification/notification.module';
import { AssistantResolver } from './assistant.resolver';
import { AssistantService } from './assistant.service';

@Module({
  imports: [BookingModule, NotificationModule],
  providers: [AssistantResolver, AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
