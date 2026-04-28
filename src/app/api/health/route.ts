import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/client';

export const runtime = 'nodejs';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_CORE',
  'STRIPE_PRICE_GROWTH',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'TOKEN_ENCRYPTION_SECRET',
  'OAUTH_STATE_SECRET',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'LINKEDIN_SCOPE',
  'LINKEDIN_API_VERSION',
] as const;

const RECOMMENDED_ENV = [
  'STRIPE_PRICE_SCALE',
  'S3_ENDPOINT',
  'S3_PUBLIC_BASE_URL',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
] as const;

export async function GET() {
  const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  const missingRecommendedEnv = RECOMMENDED_ENV.filter((key) => !process.env[key]?.trim());
  let database: 'ok' | 'error' = 'ok';

  try {
    await pool.query('select 1');
  } catch {
    database = 'error';
  }

  const healthy = missingEnv.length === 0 && database === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'error',
      checks: {
        database,
        missingEnv,
        missingRecommendedEnv,
      },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
