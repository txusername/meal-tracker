import { sql } from '../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const week = searchParams.get('week'); // 'true' to get full week

    let startDate = date;
    let endDate = date;

    if (week === 'true') {
      const d = new Date(date);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = monday.toISOString().split('T')[0];
      endDate = sunday.toISOString().split('T')[0];
    }

    const rows = await sql`
      SELECT mp.*, 
        m.name, m.category, m.calories, m.protein, m.carbs, m.fiber, m.fat, m.notes
      FROM meal_plan mp
      JOIN meals m ON mp.meal_id = m.id
      WHERE mp.plan_date BETWEEN ${startDate} AND ${endDate}
      ORDER BY mp.plan_date, mp.meal_slot
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { plan_date, meal_slot, meal_id } = await req.json();
    const rows = await sql`
      INSERT INTO meal_plan (plan_date, meal_slot, meal_id)
      VALUES (${plan_date}, ${meal_slot}, ${meal_id})
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to set meal plan' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { plan_date, meal_slot } = await req.json();
    await sql`DELETE FROM meal_plan WHERE plan_date = ${plan_date} AND meal_slot = ${meal_slot}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

