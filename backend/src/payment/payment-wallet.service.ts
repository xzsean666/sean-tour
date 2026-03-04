import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ethers } from 'ethers';
import { config } from '../config';
import {
  Web3Wallet,
  type Web3WalletConfig,
} from '../helpers/web3/wallet/web3Wallet';

export type PaymentAddressAllocation = {
  payAddress: string;
  expiredAt: string;
  walletOrderHash?: string;
  walletIndex?: number;
};

const DEFAULT_FALLBACK_PAY_ADDRESS = '0x0000000000000000000000000000000000BEEF';

@Injectable()
export class PaymentWalletService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentWalletService.name);
  private readonly orderExpiryHours = config.payment.ORDER_EXPIRY_HOURS;
  private readonly tokenDecimals = config.payment.TOKEN_DECIMALS;
  private readonly web3Wallet: Web3Wallet | null;

  constructor() {
    const initialized = this.buildWalletConfig();
    this.web3Wallet = initialized ? new Web3Wallet(initialized) : null;

    if (!this.web3Wallet && config.NODE_ENV !== 'test') {
      this.logger.warn(
        'Web3 wallet is disabled because payment env config is incomplete. Fallback payAddress will be used.',
      );
    }
  }

  isWeb3WalletEnabled(): boolean {
    return this.web3Wallet !== null;
  }

  async allocateAddressForPayment(params: {
    paymentId: string;
    expectedAmount: string;
  }): Promise<PaymentAddressAllocation> {
    const fallbackExpiredAt = new Date(
      Date.now() + this.orderExpiryHours * 60 * 60 * 1000,
    ).toISOString();

    if (!this.web3Wallet) {
      return {
        payAddress: DEFAULT_FALLBACK_PAY_ADDRESS,
        expiredAt: fallbackExpiredAt,
      };
    }

    const expectedAmountWei = ethers
      .parseUnits(params.expectedAmount, this.tokenDecimals)
      .toString();

    const order = await this.web3Wallet.createPaymentOrder(
      expectedAmountWei,
      params.paymentId,
    );

    return {
      payAddress: order.walletAddress,
      expiredAt: new Date(order.expiresAt).toISOString(),
      walletOrderHash: order.orderHash,
      walletIndex: order.walletIndex,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.web3Wallet) {
      return;
    }

    await this.web3Wallet.close();
  }

  private buildWalletConfig(): Web3WalletConfig | null {
    const missingFields: string[] = [];

    if (!config.database.url.trim()) {
      missingFields.push('DATABASE_URL');
    }

    if (!config.payment.BSC_RPC_URL.trim()) {
      missingFields.push('PAYMENT_BSC_RPC_URL');
    }

    if (!config.payment.USDT_BSC_TOKEN_ADDRESS.trim()) {
      missingFields.push('PAYMENT_USDT_BSC_TOKEN_ADDRESS');
    }

    if (!config.payment.BATCH_CALL_ADDRESS.trim()) {
      missingFields.push('PAYMENT_BATCH_CALL_ADDRESS');
    }

    if (!config.payment.MASTER_PRIVATE_KEY.trim()) {
      missingFields.push('PAYMENT_MASTER_PRIVATE_KEY');
    }

    if (missingFields.length > 0) {
      if (config.NODE_ENV !== 'test') {
        this.logger.warn(
          `Missing payment env for Web3 wallet: ${missingFields.join(', ')}`,
        );
      }

      return null;
    }

    return {
      tokenAddress: config.payment.USDT_BSC_TOKEN_ADDRESS.trim(),
      batchCallAddress: config.payment.BATCH_CALL_ADDRESS.trim(),
      rpc: config.payment.BSC_RPC_URL.trim(),
      privateKey: config.payment.MASTER_PRIVATE_KEY.trim(),
      dbUrl: config.database.url.trim(),
      chainId: config.payment.BSC_CHAIN_ID.trim() || '56',
      expiryHours: this.orderExpiryHours,
      tokenDecimals: this.tokenDecimals,
    };
  }
}
