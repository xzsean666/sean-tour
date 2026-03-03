import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { BookingResolver } from './booking.resolver';
import { BookingService } from './booking.service';

@Module({
  imports: [CatalogModule],
  providers: [BookingResolver, BookingService],
  exports: [BookingService],
})
export class BookingModule {}
