import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    HEVY_API_KEY: !!process.env.HEVY_API_KEY,
  });
}
