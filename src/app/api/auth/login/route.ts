import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, generateToken, TOKEN_COOKIE, getJwtSecret, PUBLIC_USER_COLUMNS, publicUser } from '@/lib/auth';
import { User } from '@/types';
import { guardMutation, readJson, InputError, normalizeEmail, limitAuth } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const blocked = guardMutation(req);
  if (blocked) return blocked;
  try {
    getJwtSecret();
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = body.password;
    if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: 'Укажите корректные email и пароль' }, { status: 400 });
    }
    const limited = limitAuth('login', email);
    if (limited) return limited;

    const row = db.prepare(`
      SELECT ${PUBLIC_USER_COLUMNS}, password_hash
      FROM users WHERE email = ? COLLATE NOCASE AND is_active = 1
    `).get(email) as (User & { password_hash: string }) | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, row.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    const { password_hash: _hash, ...safeRow } = row;
    const user = publicUser(safeRow);

    const token = generateToken(user);

    const res = NextResponse.json({ user, message: 'Успешная авторизация' });
    res.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error && typeof error === 'object' && 'code' in error && String(error.code).startsWith('SQLITE_CONSTRAINT_UNIQUE')) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 409 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера при авторизации' }, { status: 500 });
  }
}
