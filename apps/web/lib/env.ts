import 'server-only';

const LOCAL_SITE_URL = 'http://localhost:3000';

type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

type SupabaseServiceEnv = {
  url: string;
  serviceRoleKey: string;
};

export type SmtpEnv = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export function getIntegrationEncryptionKey() {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw missingEnvError('INTEGRATION_ENCRYPTION_KEY');
  }
  return key;
}

function missingEnvError(name: string) {
  // Log the env var name only server-side, don't expose to users
  console.error(`Missing required environment variable: ${name}`);
  return new Error(
    'إعدادات البيئة غير مكتملة. يرجى التواصل مع الدعم الفني.',
  );
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw missingEnvError('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!anonKey) {
    throw missingEnvError('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anonKey };
}

export function getSupabaseServiceEnv(): SupabaseServiceEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw missingEnvError('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw missingEnvError('SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, serviceRoleKey };
}

export function getPublicSiteUrl() {
  const rawValue =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    LOCAL_SITE_URL;

  try {
    let url = rawValue;
    // Vercel URLs don't include protocol, so we need to add it
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const normalized = new URL(url);
    normalized.hash = '';
    normalized.search = '';
    return normalized.toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      `قيمة NEXT_PUBLIC_SITE_URL غير صحيحة. NEXT_PUBLIC_SITE_URL or Vercel URLs must be valid. Received: ${rawValue}`,
    );
  }
}

export function getAdminActivationSecret() {
  const secret = process.env.ADMIN_ACTIVATION_SECRET?.trim();
  if (!secret) {
    throw missingEnvError('ADMIN_ACTIVATION_SECRET');
  }
  return secret;
}

export function getStripeSecretKey() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw missingEnvError('STRIPE_SECRET_KEY');
  }
  return secret;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw missingEnvError('STRIPE_WEBHOOK_SECRET');
  }
  return secret;
}

export function getStripePriceId(planCode: string) {
  const normalized = String(planCode || '').trim().toUpperCase();
  const envKey = `STRIPE_PRICE_ID_${normalized}`;
  const value = (process.env as Record<string, string | undefined>)[envKey]?.trim();
  if (!value) {
    throw missingEnvError(envKey);
  }
  return value;
}

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.SMTP_FROM?.trim(),
  );
}

export function getSmtpEnv(): SmtpEnv {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host) throw missingEnvError('SMTP_HOST');
  if (!portRaw) throw missingEnvError('SMTP_PORT');
  if (!user) throw missingEnvError('SMTP_USER');
  if (!pass) throw missingEnvError('SMTP_PASS');
  if (!from) throw missingEnvError('SMTP_FROM');

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('قيمة SMTP_PORT غير صحيحة. SMTP_PORT must be a valid port number.');
  }

  return { host, port, user, pass, from };
}
