import { sql } from '../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { plan_date, meal_slot, checked_off } = await req.json();
    const { rows } = await sql`
      UPDATE meal_plan 
      SET checked_off = ${checked_off}, 
          checked_at = ${checked_off ? new Date().toISOString() : null}
      WHERE plan_date = ${plan_date} AND meal_slot = ${meal_slot}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Meal plan slot not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update check-in' }, { status: 500 });
  }
}
