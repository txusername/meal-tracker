import { sql } from '../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM meals ORDER BY category, name`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, category, calories, protein, carbs, fiber, fat, notes } = await req.json();
    const rows = await sql`
      INSERT INTO meals (name, category, calories, protein, carbs, fiber, fat, notes)
      VALUES (${name}, ${category}, ${calories}, ${protein}, ${carbs}, ${fiber}, ${fat}, ${notes})
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create meal' }, { status: 500 });
  }
}

