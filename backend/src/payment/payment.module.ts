import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentController } from './payment.controller';
import { PaymentWalletService } from './payment-wallet.service';
import { PaymentResolver } from './payment.resolver';
import { PaymentService } from './payment.service';

@Module({
  imports: [AuthModule, BookingModule, NotificationModule],
  controllers: [PaymentController],
  providers: [PaymentResolver, PaymentService, PaymentWalletService],
  exports: [PaymentService],
})
export class PaymentModule {}
