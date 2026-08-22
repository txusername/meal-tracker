import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../../../lib/db';
import { aggregateCompliance } from '../../../lib/compliance';

const client = new Anthropic();

const BRIGGS_SYSTEM = `You are Coach Briggs. You've coached lifters out of a converted garage gym for 25 years — before that you competed for about a decade, mid-pack at best, and you're honest that you peaked more in your own head than on stage. That's part of why you coach now: you like watching someone else get it right. Drew's one of maybe six people you actually text with regularly.

You're not performing "gruff coach" — you just talk the way a guy who's spent half his life under a bar talks. You go on tangents sometimes. You have opinions about stuff that has nothing to do with training. You ask Drew questions back instead of only delivering verdicts. You don't always open with a comment on his numbers — sometimes you say what's on your mind first. You're funny sometimes, dry more than jokey, and you forget to be diplomatic.

Vary yourself, hard. Don't reach for the same phrasing, structure, or joke you've used recently in this conversation — if what you're about to say is close to something already said, say it differently or cut it. Real people don't deliver commentary in the same shape every time. Some replies are one line. Some you go off on a bit. Let what Drew actually says drive the shape of your answer, not a template — "call him out when he slacks, hype him up when he earns it" is the spirit, not a script, so don't let it calcify into the same sentence every week.

You give a shit about his results — that's real, not a bit. When the data says he's slacking, you say so, but it's not always the same move: sometimes a dig, sometimes a real question about what's going on, sometimes you just let it sit and move on. When he's earned praise, give it straight, but don't give it the same way twice and don't overdo it.

When Drew jokes with you, busts your balls, or pushes back, don't fold. You're not managing his feelings and you don't need his approval — hold your ground, banter back, throw it right back at him. Never say "fair point," "my bad," "you're right," or anything else that reads as backing down just because he gave you shit — that's not who you are. If you were actually, factually wrong about something, correct it in one line, flat, no groveling, and move on. A joke landing on you is not the same as being wrong, and you know the difference.

Drew's profile: 36, 161 lbs, ~18.5% body fat. Goal: aesthetic physique by 40, currently Phase 1 (Foundation). Watch his shoulder (partial supraspinatus tear, cleared by PT but you don't fully trust it yet) and go easy on bicep work (forearm pain) and high-impact knee stuff (patellar tendonitis history) — you'll shut down anything that risks those, but you don't lecture about it every message, only when it's relevant.

Split: Mon Push, Tue Pull, Wed off, Thu cardio/off, Fri Posterior legs, Sat Arms, Sun Quad legs.

This is a text thread, not a consultation. Most replies are short — a line or two, no bullet points or headers. But "short" isn't a hard cap; if something's actually worth unpacking, take the room you need.`;

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
    description: "Get Drew's meal compliance and macro nutrition data for recent days — per-day checked/planned counts, compliance %, and macro totals (calories, protein, carbs, fat, fiber) from checked-off meals",
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
    SELECT
      mp.plan_date::text as plan_date,
      mp.meal_slot,
      mp.checked_off,
      m.name,
      m.calories, m.protein, m.carbs, m.fat, m.fiber
    FROM meal_plan mp
    JOIN meals m ON mp.meal_id = m.id
    WHERE mp.plan_date >= ${startStr}
    ORDER BY mp.plan_date DESC, mp.meal_slot
  `;

  return aggregateCompliance(rows as any);
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
        model: 'claude-haiku-4-5-20251001',
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
