import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAll } from '../../../../lib/push';

export async function POST(req: NextRequest) {
  try {
    const { title, body } = await req.json();
    if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });
    const result = await sendPushToAll(title || 'Coach Briggs', body);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
