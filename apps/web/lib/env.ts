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

function missingEnvError(name: string) {
  return new Error(
    `متغير البيئة ${name} غير مضبوط. Missing required environment variable: ${name}.`,
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
  const rawValue = process.env.NEXT_PUBLIC_SITE_URL?.trim() || LOCAL_SITE_URL;

  try {
    const normalized = new URL(rawValue);
    normalized.hash = '';
    normalized.search = '';
    return normalized.toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      `قيمة NEXT_PUBLIC_SITE_URL غير صحيحة. NEXT_PUBLIC_SITE_URL must be a valid absolute URL.`,
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
