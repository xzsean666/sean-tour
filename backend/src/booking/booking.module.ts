import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingResolver } from './booking.resolver';
import { BookingService } from './booking.service';

@Module({
  imports: [AuthModule, CatalogModule, NotificationModule],
  providers: [BookingResolver, BookingService],
  exports: [BookingService],
})
export class BookingModule {}
