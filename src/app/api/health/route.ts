import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Database-backed readiness for load balancers. Never disclose environment names or secrets.
export async function GET() {
  try {
    await pool.query('select 1');
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
