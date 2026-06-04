import { sql } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const results: string[] = [];

  try {
    await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS one_off BOOLEAN DEFAULT FALSE`;
    results.push('meals.one_off: ok');
  } catch (e: any) { results.push(`meals.one_off: ${e.message}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('conversations: ok');
  } catch (e: any) { results.push(`conversations: ${e.message}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('push_subscriptions: ok');
  } catch (e: any) { results.push(`push_subscriptions: ${e.message}`); }

  try {
    await sql`ALTER TABLE meal_plan DROP CONSTRAINT IF EXISTS meal_plan_plan_date_meal_slot_key`;
    results.push('meal_plan unique constraint: dropped');
  } catch (e: any) { results.push(`meal_plan unique constraint: ${e.message}`); }

  return NextResponse.json({ success: true, results });
}
