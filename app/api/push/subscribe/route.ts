import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const { subscription } = await req.json();
    if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

    await sql`
      INSERT INTO push_subscriptions (endpoint, subscription)
      VALUES (${subscription.endpoint}, ${JSON.stringify(subscription)})
      ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription
    `;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
