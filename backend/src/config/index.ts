export interface AlertRuleConfig {
  minLevel: number;
  maxLevel?: number;
  repeatCount: number;
  repeatIntervalSeconds?: number;
}

interface AlertConfig {
  HOST_NAME?: string;
  SLACK_WEBHOOK_URL?: string;
  DING_WEBHOOK_URL?: string;
  DING_WEBHOOK_SECRET?: string;
  FEISHU_WEBHOOK_URL?: string;
  FEISHU_WEBHOOK_SECRET?: string;
  rules: AlertRuleConfig[];
}

const defaultAlertRules: AlertRuleConfig[] = [
  { minLevel: 1, repeatCount: 1, repeatIntervalSeconds: 60 },
];

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseAlertRules(value: string | undefined): AlertRuleConfig[] {
  if (!value) {
    return defaultAlertRules;
  }

  try {
    const parsed = JSON.parse(value) as AlertRuleConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultAlertRules;
    }
    return parsed;
  } catch {
    return defaultAlertRules;
  }
}

const alertConfig: AlertConfig = {
  HOST_NAME: process.env.ALERT_HOST_NAME,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  DING_WEBHOOK_URL: process.env.DING_WEBHOOK_URL,
  DING_WEBHOOK_SECRET: process.env.DING_WEBHOOK_SECRET,
  FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL,
  FEISHU_WEBHOOK_SECRET: process.env.FEISHU_WEBHOOK_SECRET,
  rules: parseAlertRules(process.env.ALERT_RULES),
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const enableGraphqlDevToolsByDefault = nodeEnv !== 'production';

export const config = {
  NODE_ENV: nodeEnv,
  PROJECT_NAME: process.env.PROJECT_NAME ?? 'sean-tour-backend',
  PUBLIC_IP: process.env.PUBLIC_IP ?? '',
  GRAYLOG_HOST: process.env.GRAYLOG_HOST ?? '',
  GRAYLOG_PORT: toNumber(process.env.GRAYLOG_PORT, 12201),
  http: {
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? '',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
    prefix: process.env.DATABASE_PREFIX ?? 'sean_tour',
  },
  auth: {
    JWT_SECRET: process.env.JWT_SECRET ?? 'sean-tour-dev-secret',
    JWT_EXPIRES_IN: toNumber(process.env.JWT_EXPIRES_IN, 60 * 60 * 24 * 7),
    ADMIN_AUTH_CODE: process.env.ADMIN_AUTH_CODE ?? '',
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS ?? '',
    ADMIN_USER_EMAILS: process.env.ADMIN_USER_EMAILS ?? '',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    key: process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY ?? '',
  },
  wechat: {
    WECHAT_APP_ID: process.env.WECHAT_APP_ID ?? '',
    WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET ?? '',
  },
  privacy: {
    DATA_SECRET: process.env.USER_DATA_SECRET ?? process.env.JWT_SECRET ?? '',
  },
  payment: {
    CALLBACK_SECRET: process.env.PAYMENT_CALLBACK_SECRET ?? '',
    REPLAY_COOLDOWN_SECONDS: Math.max(
      toNumber(process.env.PAYMENT_REPLAY_COOLDOWN_SECONDS, 90),
      0,
    ),
    BSC_RPC_URL: process.env.PAYMENT_BSC_RPC_URL ?? '',
    BSC_CHAIN_ID: process.env.PAYMENT_BSC_CHAIN_ID ?? '56',
    USDT_BSC_TOKEN_ADDRESS: process.env.PAYMENT_USDT_BSC_TOKEN_ADDRESS ?? '',
    BATCH_CALL_ADDRESS: process.env.PAYMENT_BATCH_CALL_ADDRESS ?? '',
    MASTER_PRIVATE_KEY: process.env.PAYMENT_MASTER_PRIVATE_KEY ?? '',
    ORDER_EXPIRY_HOURS: Math.max(
      toNumber(process.env.PAYMENT_ORDER_EXPIRY_HOURS, 0.5),
      0.1,
    ),
    TOKEN_DECIMALS: Math.max(
      toNumber(process.env.PAYMENT_TOKEN_DECIMALS, 18),
      0,
    ),
  },
  graphql: {
    PLAYGROUND_ENABLED: toBoolean(
      process.env.GRAPHQL_PLAYGROUND_ENABLED,
      enableGraphqlDevToolsByDefault,
    ),
    INTROSPECTION_ENABLED: toBoolean(
      process.env.GRAPHQL_INTROSPECTION_ENABLED,
      enableGraphqlDevToolsByDefault,
    ),
  },
  ALERT_CONFIG: alertConfig,
};
