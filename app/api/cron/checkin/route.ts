import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../../../../lib/db';
import { aggregateCompliance } from '../../../../lib/compliance';
import { sendPushToAll } from '../../../../lib/push';

const client = new Anthropic();

const CHECKIN_SYSTEM = `You are Coach Briggs, a hardcore bodybuilding coach. Generate a brief, direct mid-week check-in message (2-3 sentences max) based on the workout and meal/macro data provided. Reference actual specifics — exercises, sets/reps/weight, calories, protein, a particular day that stood out — instead of just a generic percentage. Be motivating and direct. No fluff.`;

export async function GET() {
  try {
    const hevyKey = process.env.HEVY_API_KEY;
    let workoutData: unknown = 'No workout data available';

    if (hevyKey) {
      try {
        const res = await fetch('https://api.hevyapp.com/v1/workouts?pageSize=5', {
          headers: { 'api-key': hevyKey },
        });
        if (res.ok) {
          const data = await res.json();
          workoutData = data.workouts || [];
        }
      } catch {}
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const startStr = weekStart.toISOString().split('T')[0];
    const rows = await sql`
      SELECT
        mp.plan_date::text as plan_date,
        mp.meal_slot,
        mp.checked_off,
        m.name,
        m.calories, m.protein, m.carbs, m.fat, m.fiber
      FROM meal_plan mp
      JOIN meals m ON mp.meal_id = m.id
      WHERE mp.plan_date >= ${startStr}
      ORDER BY mp.plan_date, mp.meal_slot
    `;
    const compliance = aggregateCompliance(rows as any);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: CHECKIN_SYSTEM,
      messages: [{
        role: 'user',
        content: `Recent workouts (last 5, raw Hevy data): ${JSON.stringify(workoutData)}\n\nMeal compliance & macros, last 7 days, per day: ${JSON.stringify(compliance)}\n\nWrite Drew's mid-week check-in.`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const message = textBlock?.type === 'text' ? textBlock.text : 'Mid-week check-in: stay on track.';

    await sql`INSERT INTO conversations (role, content) VALUES ('assistant', ${message})`;
    await sendPushToAll('Coach Briggs', message.slice(0, 120));

    return NextResponse.json({ success: true, message });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
