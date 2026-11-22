import { NextRequest, NextResponse } from 'next/server';
import { User } from '@/types';
import db from '@/lib/db';
import { getCurrentUser, PUBLIC_USER_COLUMNS, publicUser } from '@/lib/auth';
import { guardMutation, readJson, InputError, normalizeEmail } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Требуются права администратора' }, { status: 403 });
  }
  const users = db.prepare(`SELECT ${PUBLIC_USER_COLUMNS}
    FROM users WHERE is_active = 1 ORDER BY role ASC, id ASC`).all();
  return NextResponse.json({ users: (users as User[]).map(publicUser) });
}

export async function PATCH(req: NextRequest) {
  const blocked = guardMutation(req);
  if (blocked) return blocked;
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор может назначать роли' }, { status: 403 });
    }
    const { userId, email: rawEmail, role } = await readJson(req);
    const email = normalizeEmail(rawEmail);
    if (role !== 'user' && role !== 'admin' && role !== 'moderator') {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
    }
    if (userId !== undefined ? !Number.isSafeInteger(userId) || Number(userId) < 1 : !email) {
      return NextResponse.json({ error: 'Укажите корректный userId или email' }, { status: 400 });
    }
    const outcome = db.transaction(() => {
      const target = (userId !== undefined
        ? db.prepare('SELECT id, email, role FROM users WHERE id = ? AND is_active = 1').get(userId)
        : db.prepare('SELECT id, email, role FROM users WHERE email = ? COLLATE NOCASE AND is_active = 1').get(email)
      ) as { id: number; email: string; role: string } | undefined;
      if (!target) return { status: 404, error: 'Пользователь не найден. Сначала ему нужно зарегистрироваться.' };
      const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
      if (role !== 'admin' && ownerEmail && target.email.toLowerCase() === ownerEmail) {
        return { status: 403, error: 'Права владельца проекта нельзя снять через сайт' };
      }
      if (role !== 'admin' && target.role === 'admin') {
        const { count } = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1").get() as { count: number };
        if (count <= 1) return { status: 409, error: 'Нельзя снять права у последнего администратора' };
      }
      db.prepare('UPDATE users SET role = ?, is_moderator = ? WHERE id = ?').run(role === 'admin' ? 'admin' : 'user', role === 'moderator' ? 1 : 0, target.id);
      return null;
    })();
    if (outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ message: 'Права успешно обновлены' });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении прав' }, { status: 500 });
  }
}
