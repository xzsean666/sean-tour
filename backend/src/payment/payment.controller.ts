import { Body, Controller, Post } from '@nestjs/common';
import { CheckAdmin } from '../auth/auth.guard.service';
import { PaymentEventSource } from './dto/payment-event-source.enum';
import { PaymentIntent } from './dto/payment-intent.dto';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('callback/usdt')
  async receiveUsdtCallback(
    @CheckAdmin() _: boolean,
    @Body() input: UpdatePaymentStatusInput,
  ): Promise<PaymentIntent> {
    return this.paymentService.updatePaymentStatus(input, {
      requireSignature: true,
      source: PaymentEventSource.CALLBACK,
      actor: 'callback_webhook',
    });
  }

  @Post('sync')
  async syncPaymentStatus(
    @CheckAdmin() _: boolean,
    @Body() input: UpdatePaymentStatusInput,
  ): Promise<PaymentIntent> {
    return this.paymentService.updatePaymentStatus(input, {
      source: PaymentEventSource.SYNC,
      actor: 'sync_job',
    });
  }
}
