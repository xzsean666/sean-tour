#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ethers } from 'ethers';
import {
  batchCallABI,
  batchCallBytesCode,
} from '../src/helpers/web3/ethersTxBatchHelper';
import {
  buildTestFaucetErc20DeployArgs,
  createTestFaucetErc20Helper,
  testFaucetErc20ABI,
  testFaucetErc20Bytecode,
  testFaucetErc20DefaultConfig,
} from '../src/helpers/web3/testFaucetErc20Helper';

type CliArgs = Record<string, string | boolean>;
type GeneratedValueSource = 'arg' | 'env' | 'generated';
type ResolvedGeneratedValue = {
  value: string;
  source: GeneratedValueSource;
};

const backendRoot = path.resolve(__dirname, '..');

function printHelp(): void {
  console.log(`
Deploy a payment test kit (Test ERC20 faucet token + BatchCall) and inject payment env vars.

Usage:
  pnpm --dir backend deploy:payment-test-kit --rpc https://... --privateKey 0x...

Options:
  --rpc                     JSON-RPC URL. Can also use RPC_URL / PAYMENT_BSC_RPC_URL.
  --privateKey              Deployer private key. Can also use PRIVATE_KEY / PAYMENT_MASTER_PRIVATE_KEY.
  --name                    Token name. Default: ${testFaucetErc20DefaultConfig.name}
  --symbol                  Token symbol. Default: ${testFaucetErc20DefaultConfig.symbol}
  --decimals                Token decimals. Default: ${testFaucetErc20DefaultConfig.decimals}
  --initialSupply           Human-readable initial supply minted to deployer. Default: ${testFaucetErc20DefaultConfig.initialSupply}
  --faucetAmount            Human-readable amount minted by faucet(address). Default: ${testFaucetErc20DefaultConfig.faucetAmount}
  --faucetCooldownSeconds   Faucet cooldown in seconds per recipient. Default: ${testFaucetErc20DefaultConfig.faucetCooldownSeconds}
  --callbackSecret          HMAC secret for /payment/callback/usdt. Reuses PAYMENT_CALLBACK_SECRET or auto-generates.
  --adminAuthCode           Auth code for /payment/callback/usdt and /payment/sync. Reuses ADMIN_AUTH_CODE or auto-generates.
  --envFile                 Env file to auto-load and update. Default: backend/.env
  --dryRun                  Validate config and print planned env updates without deploying.
  --allowIncomplete         Allow deployment even if DATABASE_URL is missing.
  --help                    Show this message.
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current || !current.startsWith('--')) {
      continue;
    }

    const trimmed = current.slice(2);
    if (trimmed === 'help') {
      args.help = true;
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex >= 0) {
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[trimmed] = next;
      index += 1;
      continue;
    }

    args[trimmed] = true;
  }

  return args;
}

function getStringArg(
  args: CliArgs,
  keys: string[],
  envKeys: string[] = [],
): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
}

function hasFlag(args: CliArgs, keys: string[]): boolean {
  return keys.some((key) => args[key] === true);
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  label: string,
) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} 必须是大于等于 0 的整数`);
  }

  return parsed;
}

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('privateKey 不是合法的 32-byte hex 私钥');
  }

  return normalized;
}

function resolveEnvFile(rawPath?: string): string {
  if (!rawPath) {
    return path.resolve(backendRoot, '.env');
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(process.cwd(), rawPath);
}

function loadEnvFileIntoProcessEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf8');
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue;
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (isQuoted) {
      value = value.slice(1, -1);
    } else {
      const inlineCommentIndex = value.search(/\s+#/);
      if (inlineCommentIndex >= 0) {
        value = value.slice(0, inlineCommentIndex).trimEnd();
      }
    }

    parsed[key] = value;
    const currentEnvValue = process.env[key];
    if (currentEnvValue === undefined || currentEnvValue.trim() === '') {
      process.env[key] = value;
    }
  }

  return parsed;
}

function resolveOrGenerateValue(params: {
  args: CliArgs;
  argKeys: string[];
  envKeys: string[];
  generate: () => string;
}): ResolvedGeneratedValue {
  const fromArgs = getStringArg(params.args, params.argKeys);
  if (fromArgs) {
    return {
      value: fromArgs,
      source: 'arg',
    };
  }

  const fromEnv = getStringArg(params.args, [], params.envKeys);
  if (fromEnv) {
    return {
      value: fromEnv,
      source: 'env',
    };
  }

  return {
    value: params.generate(),
    source: 'generated',
  };
}

function serializeEnvValue(value: string): string {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error('env 值不能包含换行符');
  }

  return /^[A-Za-z0-9._:/@%+=,-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}

function upsertEnvFile(
  filePath: string,
  updates: Record<string, string>,
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const lines = existing === '' ? [] : existing.split(/\r?\n/);
  const nextLines = [...lines];

  for (const [key, value] of Object.entries(updates)) {
    const serialized = `${key}=${serializeEnvValue(value)}`;
    const index = nextLines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) {
      nextLines[index] = serialized;
    } else {
      nextLines.push(serialized);
    }
  }

  const normalized = nextLines.join('\n').replace(/\n*$/, '\n');
  writeFileSync(filePath, normalized, 'utf8');
}

function formatTokenAmount(amount: string, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const envFile = resolveEnvFile(
    getStringArg(args, ['envFile', 'env-file']) ?? undefined,
  );
  const loadedEnv = loadEnvFileIntoProcessEnv(envFile);
  const rpc =
    getStringArg(args, ['rpc'], ['RPC_URL', 'PAYMENT_BSC_RPC_URL']) ?? '';
  const privateKeyInput =
    getStringArg(
      args,
      ['privateKey', 'private-key'],
      ['PRIVATE_KEY', 'PAYMENT_MASTER_PRIVATE_KEY'],
    ) ?? '';
  const dryRun = hasFlag(args, ['dryRun', 'dry-run']);
  const allowIncomplete = hasFlag(args, [
    'allowIncomplete',
    'allow-incomplete',
  ]);

  if (!rpc || !privateKeyInput) {
    printHelp();
    throw new Error('必须提供 --rpc 和 --privateKey');
  }

  const privateKey = normalizePrivateKey(privateKeyInput);
  const name =
    getStringArg(args, ['name']) ?? testFaucetErc20DefaultConfig.name;
  const symbol =
    getStringArg(args, ['symbol']) ?? testFaucetErc20DefaultConfig.symbol;
  const decimals = parseInteger(
    getStringArg(args, ['decimals']),
    testFaucetErc20DefaultConfig.decimals,
    'decimals',
  );
  const initialSupply =
    getStringArg(args, ['initialSupply', 'initial-supply']) ??
    testFaucetErc20DefaultConfig.initialSupply;
  const faucetAmount =
    getStringArg(args, ['faucetAmount', 'faucet-amount']) ??
    testFaucetErc20DefaultConfig.faucetAmount;
  const faucetCooldownSeconds = parseInteger(
    getStringArg(args, ['faucetCooldownSeconds', 'faucet-cooldown-seconds']),
    testFaucetErc20DefaultConfig.faucetCooldownSeconds,
    'faucetCooldownSeconds',
  );
  const callbackSecret = resolveOrGenerateValue({
    args,
    argKeys: ['callbackSecret', 'callback-secret'],
    envKeys: ['PAYMENT_CALLBACK_SECRET'],
    generate: () => randomBytes(32).toString('hex'),
  });
  const adminAuthCode = resolveOrGenerateValue({
    args,
    argKeys: ['adminAuthCode', 'admin-auth-code'],
    envKeys: ['ADMIN_AUTH_CODE'],
    generate: () => randomBytes(24).toString('hex'),
  });
  const databaseUrl = getStringArg(args, [], ['DATABASE_URL']) ?? '';

  console.log(`Env file: ${envFile}`);
  if (Object.keys(loadedEnv).length > 0) {
    console.log(
      `Loaded ${Object.keys(loadedEnv).length} env value(s) from target file for fallback lookup.`,
    );
  }

  if (!databaseUrl && !allowIncomplete) {
    throw new Error(
      'DATABASE_URL 未配置。当前后端支付钱包服务会回退到占位收款地址，无法真正完成 createUsdtPayment 链路。若你只想部署链上测试合约，请显式加 --allowIncomplete。',
    );
  }

  const plannedEnvUpdates: Record<string, string> = {
    ADMIN_AUTH_CODE: adminAuthCode.value,
    PAYMENT_CALLBACK_SECRET: callbackSecret.value,
    PAYMENT_BSC_RPC_URL: rpc,
    PAYMENT_MASTER_PRIVATE_KEY: privateKey,
    PAYMENT_TOKEN_DECIMALS: String(decimals),
  };

  console.log(
    `PAYMENT_CALLBACK_SECRET: ${callbackSecret.source === 'generated' ? 'will be generated and persisted' : `will reuse ${callbackSecret.source}`}`,
  );
  console.log(
    `ADMIN_AUTH_CODE: ${adminAuthCode.source === 'generated' ? 'will be generated and persisted' : `will reuse ${adminAuthCode.source}`}`,
  );
  if (!databaseUrl) {
    console.warn(
      'Warning: DATABASE_URL is missing; script will only prepare chain contracts/env, not a fully usable backend payment wallet flow.',
    );
  }

  if (dryRun) {
    console.log('\nDry run only, deployment skipped.');
    console.log('Planned env updates:');
    Object.entries(plannedEnvUpdates).forEach(([key, value]) => {
      if (
        key === 'PAYMENT_MASTER_PRIVATE_KEY' ||
        key === 'PAYMENT_CALLBACK_SECRET' ||
        key === 'ADMIN_AUTH_CODE'
      ) {
        console.log(`- ${key}=<redacted>`);
        return;
      }

      console.log(`- ${key}=${value}`);
    });
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const deployer = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();
  const nativeBalance = await provider.getBalance(deployer.address);

  console.log(`RPC: ${rpc}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Native Balance: ${ethers.formatEther(nativeBalance)} ETH`);

  if (nativeBalance <= 0n) {
    throw new Error('部署账户没有原生币余额，无法支付 gas');
  }

  const signer = new ethers.NonceManager(
    new ethers.Wallet(privateKey, provider),
  );
  const tokenHelper = createTestFaucetErc20Helper(provider, {
    private_key: privateKey,
  });

  console.log('\nDeploying faucet ERC20 token...');
  const tokenFactory = new ethers.ContractFactory(
    testFaucetErc20ABI,
    testFaucetErc20Bytecode,
    signer,
  );
  const tokenContract = await tokenFactory.deploy(
    ...buildTestFaucetErc20DeployArgs({
      name,
      symbol,
      decimals,
      initialSupply,
      faucetAmount,
      faucetCooldownSeconds,
    }),
  );
  await tokenContract.waitForDeployment();
  const tokenAddress = await tokenContract.getAddress();
  const tokenMetadata = await tokenHelper.getTokenMetadata(tokenAddress);

  console.log(`Token deployed: ${tokenAddress}`);
  console.log(
    `Token config: ${tokenMetadata.name} (${tokenMetadata.symbol}), decimals=${tokenMetadata.decimals}, initialSupply=${formatTokenAmount(tokenMetadata.totalSupply, decimals)}, faucetAmount=${formatTokenAmount(tokenMetadata.faucetAmount, decimals)}, faucetCooldown=${tokenMetadata.faucetCooldown}s`,
  );

  console.log('\nDeploying BatchCall...');
  const batchCallFactory = new ethers.ContractFactory(
    batchCallABI,
    batchCallBytesCode,
    signer,
  );
  const batchCallContract = await batchCallFactory.deploy();
  await batchCallContract.waitForDeployment();
  const batchCallAddress = await batchCallContract.getAddress();
  console.log(`BatchCall deployed: ${batchCallAddress}`);

  upsertEnvFile(envFile, {
    ...plannedEnvUpdates,
    PAYMENT_BSC_CHAIN_ID: chainId,
    PAYMENT_USDT_BSC_TOKEN_ADDRESS: tokenAddress,
    PAYMENT_BATCH_CALL_ADDRESS: batchCallAddress,
  });

  console.log(`\nUpdated env file: ${envFile}`);
  console.log('\nReady for e2e payment tests.');
  console.log(`- faucet(address): anyone can mint ${faucetAmount} ${symbol}`);
  console.log(
    `- ownerMint(address, amount): deployer can mint arbitrary amount`,
  );
  console.log(
    `- callback secret: ${callbackSecret.source === 'generated' ? 'generated and persisted to env file' : `reused existing ${callbackSecret.source}`}`,
  );
  console.log(
    `- admin auth code: ${adminAuthCode.source === 'generated' ? 'generated and persisted to env file' : `reused existing ${adminAuthCode.source}`}`,
  );
  console.log(
    '- smoke callback example: pnpm --dir backend smoke:payment-callback --bookingId <bookingId> --status PAID --paidAmount <amount>',
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nDeployment failed: ${message}`);
  process.exitCode = 1;
});
