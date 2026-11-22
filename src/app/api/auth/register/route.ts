import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, generateToken, TOKEN_COOKIE, getJwtSecret } from '@/lib/auth';
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
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const university = body.university === undefined ? 'КМУ' : body.university;
    const specialty = body.specialty === undefined ? 'Общая медицина' : body.specialty;
    if (!email || !full_name || full_name.length > 150 || typeof university !== 'string' || university.length > 150 || typeof specialty !== 'string' || specialty.length > 150) {
      return NextResponse.json({ error: 'Укажите корректные ФИО и email. Длина полей — до 150 символов.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: 'Пароль должен содержать от 12 символов и не более 72 байт' }, { status: 400 });
    }
    const limited = limitAuth('register', email);
    if (limited) return limited;

    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    
    // Standard role is user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, university, specialty)
      VALUES (?, ?, ?, 'user', ?, ?)
    `).run(email, password_hash, full_name, university || 'КМУ', specialty || 'Общая медицина');

    const newUser: User = {
      id: Number(result.lastInsertRowid),
      email,
      full_name,
      role: 'user',
      university: university || 'КМУ',
      specialty: specialty || 'Общая медицина',
      created_at: new Date().toISOString(),
    };

    const token = generateToken(newUser);

    const res = NextResponse.json({ user: newUser, message: 'Регистрация прошла успешно' }, { status: 201 });
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
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Ошибка сервера при регистрации' }, { status: 500 });
  }
}
