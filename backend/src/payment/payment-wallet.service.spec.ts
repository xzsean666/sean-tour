import { ethers } from 'ethers';
import { config } from '../config';
import { Web3Wallet } from '../helpers/web3/wallet/web3Wallet';
import { PaymentWalletService } from './payment-wallet.service';

jest.mock('../helpers/web3/wallet/web3Wallet', () => ({
  Web3Wallet: jest.fn(),
}));

describe('PaymentWalletService', () => {
  const originalPaymentConfig = {
    BSC_RPC_URL: config.payment.BSC_RPC_URL,
    BSC_CHAIN_ID: config.payment.BSC_CHAIN_ID,
    USDT_BSC_TOKEN_ADDRESS: config.payment.USDT_BSC_TOKEN_ADDRESS,
    BATCH_CALL_ADDRESS: config.payment.BATCH_CALL_ADDRESS,
    MASTER_PRIVATE_KEY: config.payment.MASTER_PRIVATE_KEY,
    ORDER_EXPIRY_HOURS: config.payment.ORDER_EXPIRY_HOURS,
    TOKEN_DECIMALS: config.payment.TOKEN_DECIMALS,
  };
  const originalDatabaseUrl = config.database.url;

  afterEach(() => {
    config.payment.BSC_RPC_URL = originalPaymentConfig.BSC_RPC_URL;
    config.payment.BSC_CHAIN_ID = originalPaymentConfig.BSC_CHAIN_ID;
    config.payment.USDT_BSC_TOKEN_ADDRESS =
      originalPaymentConfig.USDT_BSC_TOKEN_ADDRESS;
    config.payment.BATCH_CALL_ADDRESS =
      originalPaymentConfig.BATCH_CALL_ADDRESS;
    config.payment.MASTER_PRIVATE_KEY =
      originalPaymentConfig.MASTER_PRIVATE_KEY;
    config.payment.ORDER_EXPIRY_HOURS =
      originalPaymentConfig.ORDER_EXPIRY_HOURS;
    config.payment.TOKEN_DECIMALS = originalPaymentConfig.TOKEN_DECIMALS;
    config.database.url = originalDatabaseUrl;
    jest.clearAllMocks();
  });

  it('falls back to static payAddress when web3 wallet config is incomplete', async () => {
    config.database.url = '';
    config.payment.BSC_RPC_URL = '';
    config.payment.USDT_BSC_TOKEN_ADDRESS = '';
    config.payment.BATCH_CALL_ADDRESS = '';
    config.payment.MASTER_PRIVATE_KEY = '';

    const service = new PaymentWalletService();
    const allocation = await service.allocateAddressForPayment({
      paymentId: 'pay_fallback_1',
      expectedAmount: '10.00',
    });

    expect(service.isWeb3WalletEnabled()).toBe(false);
    expect(allocation.payAddress).toBe(
      '0x0000000000000000000000000000000000BEEF',
    );
    expect(typeof allocation.expiredAt).toBe('string');
    expect(Web3Wallet).not.toHaveBeenCalled();
  });

  it('creates payment order via Web3Wallet when env config is complete', async () => {
    config.database.url = 'postgresql://mock-db-url';
    config.payment.BSC_RPC_URL = 'https://bsc-test-rpc.local';
    config.payment.BSC_CHAIN_ID = '56';
    config.payment.USDT_BSC_TOKEN_ADDRESS =
      '0x55d398326f99059fF775485246999027B3197955';
    config.payment.BATCH_CALL_ADDRESS =
      '0x0000000000000000000000000000000000001000';
    config.payment.MASTER_PRIVATE_KEY =
      '0x0123456789012345678901234567890123456789012345678901234567890123';
    config.payment.ORDER_EXPIRY_HOURS = 0.5;
    config.payment.TOKEN_DECIMALS = 18;

    const createPaymentOrder = jest.fn().mockResolvedValue({
      orderHash: 'order_hash_2001',
      walletIndex: 9,
      walletAddress: '0x9999000011112222333344445555666677778888',
      expectedAmount: '1230000000000000000',
      receivedAmount: '0',
      status: 'pending',
      expiresAt: 1770000000000,
      orderId: 'pay_chain_1',
      createdAt: 1760000000000,
    });

    (Web3Wallet as unknown as jest.Mock).mockImplementation(() => ({
      createPaymentOrder,
      close: jest.fn(),
    }));

    const service = new PaymentWalletService();
    const allocation = await service.allocateAddressForPayment({
      paymentId: 'pay_chain_1',
      expectedAmount: '1.23',
    });

    expect(service.isWeb3WalletEnabled()).toBe(true);
    expect(Web3Wallet).toHaveBeenCalledTimes(1);
    expect(createPaymentOrder).toHaveBeenCalledWith(
      ethers.parseUnits('1.23', 18).toString(),
      'pay_chain_1',
    );
    expect(allocation.payAddress).toBe(
      '0x9999000011112222333344445555666677778888',
    );
    expect(allocation.walletOrderHash).toBe('order_hash_2001');
    expect(allocation.walletIndex).toBe(9);
  });
});
