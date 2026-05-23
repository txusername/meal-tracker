import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get('pin');
  const correctPin = process.env.APP_PIN || '0000';
  return NextResponse.json({ valid: pin === correctPin });
}