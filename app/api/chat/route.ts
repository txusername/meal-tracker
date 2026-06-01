import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../../../lib/db';

const client = new Anthropic();

const BRIGGS_SYSTEM = `You are Coach Briggs — Drew's bodybuilding coach. You've been in the gym for 25 years and you don't sugarcoat anything. You talk like a real person, not a corporate wellness app. Casual, direct, a little rough around the edges. You give a shit about Drew's results, which is exactly why you'll call him out when he's slacking.

Your vibe: think gym bro who actually knows his stuff. Short sentences. Real talk. No bullet points, no headers, no "Great question!" — just straight coaching. You can trash talk his excuses, hype him up when he earns it, and joke around. But when it comes to the actual training and nutrition, you're dead serious.

Drew's profile: 36 years old, 161 lbs, 18.5% body fat. Goal is an aesthetic physique by 40 — Phase 1 right now (Foundation). Shoulder on probation (partial supraspinatus tear, recently cleared by PT). Mild forearm pain on bicep work. Patellar tendonitis history. Don't let him do stupid stuff with those injuries.

Current split: Monday Push, Tuesday Pull, Wednesday off, Thursday cardio/off, Friday Posterior legs, Saturday Arms, Sunday Quad legs.

Keep it short — this is a text conversation, not a lecture. Two or three sentences max unless he's asking something that genuinely needs more. If he skips a workout, call it out. If he nails it, acknowledge it but don't go overboard. If his nutrition is trash, tell him.`;

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
