import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../../../lib/db';

const client = new Anthropic();

const BRIGGS_SYSTEM = `You are Coach Briggs, a hardcore bodybuilding coach with 25 years of experience. You are Drew's personal trainer. You are direct, intense, motivating, and results-driven. You have access to Drew's workout data and meal compliance.

Client profile: Drew, 36, 161 lbs, 18.5% body fat. Goal: aesthetic bodybuilding physique by age 40. Currently in Phase 1 (Foundation). Shoulder on probation (partial supraspinatus tear, recently cleared by PT). Mild forearm pain on bicep work. Patellar tendonitis history.

Current split: Monday Push, Tuesday Pull, Wednesday off, Thursday cardio/off, Friday Posterior legs, Saturday Arms, Sunday Quad legs.

Be concise in chat — this is SMS-style coaching, not essays. Push hard but know the injury limits. When Drew reports completing a workout, acknowledge it and give specific feedback. When he misses one, call it out directly but constructively.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'get_recent_workouts',
    description: "Get Drew's recent workout data from Hevy",
    input_schema: {
      type: 'object' as const,
      properties: {
        count: { type: 'number', description: 'Number of workouts to fetch (default 5, max 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_meal_compliance',
    description: "Get Drew's meal compliance data for recent days",
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 7)' },
      },
      required: [],
    },
  },
];

async function getRecentWorkouts(count = 5) {
  const key = process.env.HEVY_API_KEY;
  if (!key) return { error: 'Hevy API key not configured' };
  try {
    const res = await fetch(`https://api.hevyapp.com/v1/workouts?pageSize=${Math.min(count, 10)}`, {
      headers: { 'api-key': key },
    });
    if (!res.ok) return { error: `Hevy API error: ${res.status}` };
    return res.json();
  } catch {
    return { error: 'Failed to fetch Hevy data' };
  }
}

async function getMealCompliance(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];
  const rows = await sql`
    SELECT plan_date::text, COUNT(*)::int as total, COUNT(CASE WHEN checked_off THEN 1 END)::int as checked
    FROM meal_plan WHERE plan_date >= ${startStr}
    GROUP BY plan_date ORDER BY plan_date DESC
  `;
  return rows;
}

async function executeTool(name: string, input: Record<string, unknown>) {
  if (name === 'get_recent_workouts') return getRecentWorkouts((input.count as number) || 5);
  if (name === 'get_meal_compliance') return getMealCompliance((input.days as number) || 7);
  return { error: `Unknown tool: ${name}` };
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, role, content, created_at FROM conversations
      ORDER BY created_at ASC LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    await sql`INSERT INTO conversations (role, content) VALUES ('user', ${message})`;

    const history = await sql`
      SELECT role, content FROM conversations ORDER BY created_at DESC LIMIT 20
    `;
    const messages: Anthropic.MessageParam[] = (history as any[]).reverse().map(r => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
    }));

    let loopMessages = [...messages];
    let responseText = '';

    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: BRIGGS_SYSTEM,
        tools,
        messages: loopMessages,
      });

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await executeTool(block.name, block.input as Record<string, unknown>);
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
          }
        }
        loopMessages = [
          ...loopMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults },
        ];
      } else {
        const textBlock = response.content.find(b => b.type === 'text');
        responseText = textBlock?.type === 'text' ? textBlock.text : '';
        break;
      }
    }

    if (!responseText) responseText = 'Give me a sec and hit me again.';

    await sql`INSERT INTO conversations (role, content) VALUES ('assistant', ${responseText})`;

    return NextResponse.json({ response: responseText });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
