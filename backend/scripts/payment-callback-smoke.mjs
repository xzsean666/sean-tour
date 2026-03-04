#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const ENDPOINT_PATH = {
  callback: '/payment/callback/usdt',
  sync: '/payment/sync',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

function printHelp() {
  console.log(`\nPayment callback/sync smoke tool\n\nUsage:\n  node backend/scripts/payment-callback-smoke.mjs --bookingId bk_xxx --paidAmount 100.00 [options]\n\nRequired:\n  --status <PENDING|PARTIALLY_PAID|PAID|EXPIRED|FAILED|CANCELLED>\n  One of: --paymentId <id> or --bookingId <id>\n\nOptions:\n  --endpoint <callback|sync>     Default: callback\n  --paidAmount <amount>          Default: 0.00\n  --txHash <hash>                Default: 0xsmoketest\n  --confirmations <number>       Default: 12\n  --eventId <id>                 Default: evt_smoke_<ts>_<uuid8>\n  --replayOfEventId <id>         Optional\n  --adminAuthCode <code>         Or env ADMIN_AUTH_CODE\n  --secret <secret>              Or env PAYMENT_CALLBACK_SECRET\n  --baseUrl <url>                Or env PAYMENT_BASE_URL, default: ${DEFAULT_BASE_URL}\n  --url <full_url>               Optional, overrides endpoint/baseUrl\n  --dryRun                       Print payload/signature only, do not send request\n  --help                         Show help\n\nExamples:\n  node backend/scripts/payment-callback-smoke.mjs \\\n    --bookingId bk_123 \\\n    --status PAID \\\n    --paidAmount 100.00\n\n  node backend/scripts/payment-callback-smoke.mjs \\\n    --endpoint sync \\\n    --paymentId pay_123 \\\n    --status PARTIALLY_PAID \\\n    --paidAmount 30.00 \\\n    --confirmations 3\n`);
}

function requireNonEmpty(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  return String(value).trim();
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  const allowed = new Set([
    'PENDING',
    'PARTIALLY_PAID',
    'PAID',
    'EXPIRED',
    'FAILED',
    'CANCELLED',
  ]);

  if (!allowed.has(normalized)) {
    throw new Error(
      `Invalid status '${status}'. Allowed: ${Array.from(allowed).join(', ')}`,
    );
  }

  return normalized;
}

function normalizeEndpoint(endpoint) {
  const normalized = String(endpoint || 'callback').trim().toLowerCase();
  if (normalized !== 'callback' && normalized !== 'sync') {
    throw new Error(`Invalid endpoint '${endpoint}'. Allowed: callback, sync`);
  }
  return normalized;
}

function buildSignaturePayload(input) {
  return [
    input.eventId?.trim() || '',
    input.paymentId?.trim() || '',
    input.bookingId?.trim() || '',
    input.status || '',
    input.paidAmount?.trim() || '',
    input.txHash?.trim() || '',
    input.confirmations !== undefined ? String(input.confirmations) : '',
  ].join('|');
}

function computeSignature(input, secret) {
  const payload = buildSignaturePayload(input);
  return createHmac('sha256', secret).update(payload).digest('hex');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === 'true') {
    printHelp();
    return;
  }

  const status = normalizeStatus(args.status);
  const endpoint = normalizeEndpoint(args.endpoint);
  const paymentId = String(args.paymentId || '').trim();
  const bookingId = String(args.bookingId || '').trim();

  if (!paymentId && !bookingId) {
    throw new Error('One of paymentId or bookingId is required');
  }

  const baseUrl =
    String(args.baseUrl || process.env.PAYMENT_BASE_URL || '').trim() ||
    DEFAULT_BASE_URL;
  const callbackUrl =
    String(args.url || process.env.PAYMENT_CALLBACK_URL || '').trim() ||
    `${baseUrl}${ENDPOINT_PATH[endpoint]}`;
  const adminAuthCode = requireNonEmpty(
    args.adminAuthCode || process.env.ADMIN_AUTH_CODE,
    'ADMIN_AUTH_CODE',
  );
  const secret =
    String(args.secret || process.env.PAYMENT_CALLBACK_SECRET || '').trim() ||
    undefined;

  const confirmationsRaw = String(args.confirmations || '12').trim();
  const confirmations = Number.parseInt(confirmationsRaw, 10);
  if (!Number.isFinite(confirmations) || confirmations < 0) {
    throw new Error('confirmations must be a non-negative integer');
  }

  const payload = {
    paymentId: paymentId || undefined,
    bookingId: bookingId || undefined,
    status,
    paidAmount: String(args.paidAmount || '0.00').trim(),
    txHash: String(args.txHash || '0xsmoketest').trim(),
    confirmations,
    eventId:
      String(args.eventId || '').trim() ||
      `evt_smoke_${Date.now()}_${randomUUID().slice(0, 8)}`,
    replayOfEventId: String(args.replayOfEventId || '').trim() || undefined,
  };

  const requestBody = {
    ...payload,
  };
  if (endpoint === 'callback') {
    if (!secret) {
      throw new Error('PAYMENT_CALLBACK_SECRET is required for callback mode');
    }
    requestBody.signature = computeSignature(payload, secret);
  } else if (secret) {
    requestBody.signature = computeSignature(payload, secret);
  }

  const dryRun = args.dryRun === 'true';
  if (dryRun) {
    console.log('Dry run only, request not sent.');
    console.log(JSON.stringify({ callbackUrl, requestBody }, null, 2));
    return;
  }

  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      admin_auth_code: adminAuthCode,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(
      `Callback failed: HTTP ${response.status} ${response.statusText}\n${typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}`,
    );
  }

  console.log('Callback succeeded.');
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
