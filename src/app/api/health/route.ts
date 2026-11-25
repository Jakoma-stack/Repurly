import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Database-backed readiness for load balancers. Never disclose environment names or secrets.
export async function GET() {
  try {
    // Readiness includes the schema fields needed for workspace creation and
    // usage accounting, not merely whether PostgreSQL accepts a connection.
    await Promise.all([
      pool.query('SELECT stripe_price_id, stripe_subscription_status, stripe_current_period_end, stripe_cancel_at_period_end FROM workspaces LIMIT 0'),
      pool.query('SELECT metric_key, period_key FROM usage_events LIMIT 0'),
    ]);
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
