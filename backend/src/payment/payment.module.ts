import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { PaymentResolver } from './payment.resolver';
import { PaymentService } from './payment.service';

@Module({
  imports: [BookingModule],
  providers: [PaymentResolver, PaymentService],
})
export class PaymentModule {}
