import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import crypto from 'crypto';

function verifyTelegramAuth(
  token: string,
  data: Record<string, string | number>,
  isTwa: boolean,
): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) {
    stringData[key] = String(value);
  }

  const dataCheckString = Object.keys(stringData)
    .sort()
    .map((key) => `${key}=${stringData[key]}`)
    .join('\n');

  let generatedHash: string;

  if (isTwa) {
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(token)
      .digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString);
    generatedHash = hmac.digest('hex');
  } else {
    const secretKey = crypto.createHash('sha256').update(token).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString);
    generatedHash = hmac.digest('hex');
  }

  return generatedHash === hash;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not defined in .env');

  let userData;
  let isValid = false;

  if (body.initData) {
    const params = new URLSearchParams(body.initData);
    const data: Record<string, string> = {};
    params.forEach((value, key) => (data[key] = value));
    const userParam = params.get('user');
    if (!userParam)
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 400 },
      );
    userData = JSON.parse(userParam);
    isValid = verifyTelegramAuth(token, data, true);
  } else {
    userData = body;
    isValid = verifyTelegramAuth(token, userData, false);
  }

  if (!isValid)
    return NextResponse.json(
      { error: 'Invalid authentication data' },
      { status: 401 },
    );

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is not defined in .env');

  const userPayload = {
    id: userData.id,
    first_name: userData.first_name,
    username: userData.username,
  };

  const secret = new TextEncoder().encode(jwtSecret);
  const tokenJwt = await new SignJWT(userPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1w')
    .sign(secret);

  const response = NextResponse.json(userPayload);
  response.cookies.set('auth_token', tokenJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
