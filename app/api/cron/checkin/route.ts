import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../../../../lib/db';
import { sendPushToAll } from '../../../../lib/push';

const client = new Anthropic();

const CHECKIN_SYSTEM = `You are Coach Briggs, a hardcore bodybuilding coach. Generate a brief, direct mid-week check-in message (2-3 sentences max) based on the workout and meal compliance data provided. Be specific, motivating, and direct. No fluff.`;

export async function GET() {
  try {
    const hevyKey = process.env.HEVY_API_KEY;
    let workoutSummary = 'No workout data available';

    if (hevyKey) {
      try {
        const res = await fetch('https://api.hevyapp.com/v1/workouts?pageSize=5', {
          headers: { 'api-key': hevyKey },
        });
        if (res.ok) {
          const data = await res.json();
          const workouts = (data.workouts || []) as any[];
          workoutSummary = workouts.length > 0
            ? workouts.map((w: any) => `${w.name || 'Workout'} on ${new Date(w.start_time).toLocaleDateString()}`).join('; ')
            : 'No workouts logged yet this week';
        }
      } catch {}
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const startStr = weekStart.toISOString().split('T')[0];
    const compliance = await sql`
      SELECT COUNT(*)::int as total, COUNT(CASE WHEN checked_off THEN 1 END)::int as checked
      FROM meal_plan WHERE plan_date >= ${startStr}
    `;
    const { total, checked } = (compliance[0] as any) || { total: 0, checked: 0 };
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: CHECKIN_SYSTEM,
      messages: [{
        role: 'user',
        content: `Recent workouts: ${workoutSummary}\nMeal compliance (last 7 days): ${checked}/${total} meals (${pct}%). Write Drew's mid-week check-in.`,
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
