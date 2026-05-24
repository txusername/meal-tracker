import { sql } from '../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Verify MCP auth token
function verifyToken(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization');
  if (!auth) return false;
  const token = auth.replace('Bearer ', '');
  return token === process.env.MCP_AUTH_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case 'post_weekly_plan': {
        // data: array of { plan_date, meal_slot, meal_id }
        const results = [];
        for (const slot of data) {
          const rows = await sql`
            INSERT INTO meal_plan (plan_date, meal_slot, meal_id)
            VALUES (${slot.plan_date}, ${slot.meal_slot}, ${slot.meal_id})
            ON CONFLICT (plan_date, meal_slot) DO UPDATE SET meal_id = ${slot.meal_id}, checked_off = false
            RETURNING *
          `;
          results.push(rows[0]);
        }
        return NextResponse.json({ success: true, slots_created: results.length });
      }

      case 'add_meal': {
        // data: meal object
        const { name, category, calories, protein, carbs, fiber, fat, notes, one_off } = data;
        const rows = await sql`
          INSERT INTO meals (name, category, calories, protein, carbs, fiber, fat, notes, one_off)
          VALUES (${name}, ${category}, ${calories}, ${protein}, ${carbs}, ${fiber || 0}, ${fat}, ${notes || null}, ${one_off || false})
          RETURNING *
        `;
        return NextResponse.json({ success: true, meal: rows[0] });
      }

      case 'get_compliance': {
        // data: { start_date, end_date }
        const rows = await sql`
          SELECT 
            plan_date,
            COUNT(*) as total_slots,
            SUM(CASE WHEN checked_off THEN 1 ELSE 0 END) as checked_slots
          FROM meal_plan
          WHERE plan_date BETWEEN ${data.start_date} AND ${data.end_date}
          GROUP BY plan_date
          ORDER BY plan_date
        `;
        return NextResponse.json({ compliance: rows });
      }

      case 'get_meals': {
        const rows = await sql`SELECT * FROM meals ORDER BY category, name`;
        return NextResponse.json({ meals: rows });
      }
      case 'clear_meal_slot': {
        await sql`
          DELETE FROM meal_plan 
          WHERE plan_date = ${data.plan_date} AND meal_slot = ${data.meal_slot}
        `;
        return NextResponse.json({ success: true });
      }

      case 'clear_day_plan': {
        await sql`
          DELETE FROM meal_plan 
          WHERE plan_date = ${data.plan_date}
        `;
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'MCP action failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    status: 'ok',
    actions: ['post_weekly_plan', 'add_meal', 'get_compliance', 'get_meals']
  });
}
