import { sql } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await sql`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS one_off BOOLEAN DEFAULT FALSE
    `;
    return NextResponse.json({ success: true, message: 'Migration complete: one_off column added' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
