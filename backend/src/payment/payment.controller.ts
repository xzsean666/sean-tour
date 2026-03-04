import { Body, Controller, Post } from '@nestjs/common';
import { CheckAdmin } from '../auth/auth.guard.service';
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
    return this.paymentService.updatePaymentStatus(input);
  }

  @Post('sync')
  async syncPaymentStatus(
    @CheckAdmin() _: boolean,
    @Body() input: UpdatePaymentStatusInput,
  ): Promise<PaymentIntent> {
    return this.paymentService.updatePaymentStatus(input);
  }
}
