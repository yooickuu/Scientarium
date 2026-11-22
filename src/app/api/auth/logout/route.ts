import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/auth';
import { guardMutation } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const blocked = guardMutation(req, false);
  if (blocked) return blocked;
  const res = NextResponse.json({ message: 'Вы успешно вышли из системы' });
  res.cookies.set(TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  return res;
}
