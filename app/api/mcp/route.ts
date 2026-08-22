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
          await sql`DELETE FROM meal_plan WHERE plan_date = ${slot.plan_date} AND meal_slot = ${slot.meal_slot}`;
          const rows = await sql`
            INSERT INTO meal_plan (plan_date, meal_slot, meal_id)
            VALUES (${slot.plan_date}, ${slot.meal_slot}, ${slot.meal_id})
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
            mp.plan_date::text as plan_date,
            mp.meal_slot,
            mp.checked_off,
            m.name,
            m.calories, m.protein, m.carbs, m.fat, m.fiber
          FROM meal_plan mp
          JOIN meals m ON mp.meal_id = m.id
          WHERE mp.plan_date BETWEEN ${data.start_date} AND ${data.end_date}
          ORDER BY mp.plan_date, mp.meal_slot
        `;

        const byDate = new Map<string, any>();
        for (const row of rows) {
          if (!byDate.has(row.plan_date)) {
            byDate.set(row.plan_date, {
              date: row.plan_date,
              meals_planned: 0,
              meals_checked: 0,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              meals: [],
            });
          }
          const day = byDate.get(row.plan_date);
          const checked = !!row.checked_off;
          day.meals_planned += 1;
          if (checked) {
            day.meals_checked += 1;
            day.calories += Number(row.calories);
            day.protein += Number(row.protein);
            day.carbs += Number(row.carbs);
            day.fat += Number(row.fat);
            day.fiber += Number(row.fiber);
          }
          day.meals.push({
            meal_slot: row.meal_slot,
            name: row.name,
            checked,
            calories: Number(row.calories),
            protein: Number(row.protein),
            carbs: Number(row.carbs),
            fat: Number(row.fat),
            fiber: Number(row.fiber),
          });
        }

        const compliance = Array.from(byDate.values()).map((day) => ({
          ...day,
          compliance_pct: day.meals_planned > 0 ? Math.round((day.meals_checked / day.meals_planned) * 100) : 0,
        }));

        return NextResponse.json({ compliance });
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
