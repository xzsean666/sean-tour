import { ethers } from 'ethers';
import {
  EthersTxHelper,
  type EthersTxHelperConfig,
  type EthersTxOverrides,
  type WaitReceiptOptions,
} from './ethersTxHelper';
import {
  testFaucetErc20ABI,
  testFaucetErc20Bytecode,
} from './contracts/testFaucetErc20Artifact.generated';

export interface TestFaucetErc20DeployParams {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply?: string;
  initialSupplyWei?: ethers.BigNumberish;
  faucetAmount?: string;
  faucetAmountWei?: ethers.BigNumberish;
  faucetCooldownSeconds?: number;
}

export interface TestFaucetErc20Metadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  faucetAmount: string;
  faucetCooldown: number;
  owner: string;
}

export interface TestFaucetErc20TxOptions extends WaitReceiptOptions {
  txOverrides?: EthersTxOverrides;
  waitConfirm?: boolean;
}

function normalizeTokenDecimals(decimals?: number): number {
  if (decimals === undefined) {
    return 18;
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('ERC20 decimals 必须是 0-255 的整数');
  }

  return decimals;
}

function normalizeTokenAmount(params: {
  amount?: string;
  amountWei?: ethers.BigNumberish;
  decimals: number;
  label: string;
}): bigint {
  const { amount, amountWei, decimals, label } = params;

  if (amount !== undefined && amountWei !== undefined) {
    throw new Error(`${label} 和 ${label}Wei 不能同时传入`);
  }

  if (amountWei !== undefined) {
    return ethers.toBigInt(amountWei);
  }

  if (amount === undefined || amount.trim() === '') {
    return 0n;
  }

  return ethers.parseUnits(amount.trim(), decimals);
}

export function buildTestFaucetErc20DeployArgs(
  params: TestFaucetErc20DeployParams,
): [string, string, number, bigint, bigint, number] {
  const decimals = normalizeTokenDecimals(params.decimals);
  const initialSupply = normalizeTokenAmount({
    amount: params.initialSupply,
    amountWei: params.initialSupplyWei,
    decimals,
    label: 'initialSupply',
  });
  const faucetAmount = normalizeTokenAmount({
    amount: params.faucetAmount,
    amountWei: params.faucetAmountWei,
    decimals,
    label: 'faucetAmount',
  });
  const faucetCooldownSeconds = Math.max(
    Math.floor(params.faucetCooldownSeconds ?? 0),
    0,
  );

  return [
    params.name,
    params.symbol,
    decimals,
    initialSupply,
    faucetAmount,
    faucetCooldownSeconds,
  ];
}

export class TestFaucetErc20Helper extends EthersTxHelper {
  async deployTestToken(
    params: TestFaucetErc20DeployParams,
  ): Promise<ethers.BaseContract> {
    return await this.deployContract(
      testFaucetErc20ABI,
      testFaucetErc20Bytecode,
      buildTestFaucetErc20DeployArgs(params),
    );
  }

  async getTokenMetadata(
    tokenAddress: string,
  ): Promise<TestFaucetErc20Metadata> {
    const [
      name,
      symbol,
      decimals,
      totalSupply,
      faucetAmount,
      faucetCooldown,
      owner,
    ] = await Promise.all([
      this.callReadContract<string>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'name',
      }),
      this.callReadContract<string>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'symbol',
      }),
      this.callReadContract<number>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'decimals',
      }),
      this.callReadContract<bigint>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'totalSupply',
      }),
      this.callReadContract<bigint>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'faucetAmount',
      }),
      this.callReadContract<bigint>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'faucetCooldown',
      }),
      this.callReadContract<string>({
        target: tokenAddress,
        abi: testFaucetErc20ABI,
        function_name: 'owner',
      }),
    ]);

    return {
      name,
      symbol,
      decimals,
      totalSupply: totalSupply.toString(),
      faucetAmount: faucetAmount.toString(),
      faucetCooldown: Number(faucetCooldown),
      owner,
    };
  }

  async faucet(
    tokenAddress: string,
    recipient: string,
    options: TestFaucetErc20TxOptions = {},
  ) {
    const params = {
      target: tokenAddress,
      abi: testFaucetErc20ABI,
      function_name: 'faucet',
      execute_args: [recipient],
      confirmations: options.confirmations,
      timeoutMs: options.timeoutMs,
      txOverrides: options.txOverrides,
    };

    if (options.waitConfirm) {
      return await this.callContract({
        ...params,
        waitConfirm: true,
      });
    }

    return await this.callContract(params);
  }

  async ownerMint(
    tokenAddress: string,
    recipient: string,
    amount: string,
    decimals: number = 18,
    options: TestFaucetErc20TxOptions = {},
  ) {
    const params = {
      target: tokenAddress,
      abi: testFaucetErc20ABI,
      function_name: 'ownerMint',
      execute_args: [recipient, ethers.parseUnits(amount, decimals)],
      confirmations: options.confirmations,
      timeoutMs: options.timeoutMs,
      txOverrides: options.txOverrides,
    };

    if (options.waitConfirm) {
      return await this.callContract({
        ...params,
        waitConfirm: true,
      });
    }

    return await this.callContract(params);
  }
}

export const testFaucetErc20DefaultConfig = {
  name: 'Sean Tour Test USDT',
  symbol: 'tUSDT',
  decimals: 18,
  initialSupply: '1000000',
  faucetAmount: '1000',
  faucetCooldownSeconds: 0,
} as const;

export function createTestFaucetErc20Helper(
  provider: string | ethers.BrowserProvider | ethers.JsonRpcProvider,
  config: EthersTxHelperConfig = {},
): TestFaucetErc20Helper {
  return new TestFaucetErc20Helper(provider, config);
}

export { testFaucetErc20ABI, testFaucetErc20Bytecode };
