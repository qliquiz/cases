import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  const secret = process.env.JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET is not defined in .env');
  if (!token)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
