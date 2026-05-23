import { sql } from '../../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, category, calories, protein, carbs, fiber, fat, notes } = await req.json();
    const id = parseInt(params.id);
    const rows = await sql`
      UPDATE meals
      SET name = ${name}, category = ${category}, calories = ${calories},
          protein = ${protein}, carbs = ${carbs}, fiber = ${fiber},
          fat = ${fat}, notes = ${notes}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update meal' }, { status: 500 });
  }
}
