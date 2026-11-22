import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { MedicalEvent } from '@/types';
import { guardMutation, readJson, InputError } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const rows = db.prepare(`
      SELECT e.*, 1 as is_bookmarked
      FROM events e
      INNER JOIN bookmarks b ON e.id = b.event_id
      WHERE b.user_id = ?
      ORDER BY e.start_date ASC
    `).all(user.id) as any[];

    const events: MedicalEvent[] = rows.map((r) => ({
      ...r,
      is_featured: Boolean(r.is_featured),
      is_bookmarked: true,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Get bookmarks error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = guardMutation(req, true);
  if (blocked) return blocked;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const { event_id } = await readJson(req);
    if (!Number.isSafeInteger(event_id) || Number(event_id) < 1) {
      return NextResponse.json({ error: 'Не указан event_id' }, { status: 400 });
    }

    if (!db.prepare('SELECT id FROM events WHERE id = ?').get(event_id)) {
      return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 });
    }
    db.prepare(`
      INSERT OR IGNORE INTO bookmarks (user_id, event_id)
      VALUES (?, ?)
    `).run(user.id, event_id);

    return NextResponse.json({ bookmarked: true, message: 'Добавлено в избранное' });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Add bookmark error:', error);
    return NextResponse.json({ error: 'Ошибка при сохранении' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = guardMutation(req, false);
  if (blocked) return blocked;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventIdStr = searchParams.get('event_id');
    const event_id = eventIdStr ? Number(eventIdStr) : null;

    if (!Number.isSafeInteger(event_id) || Number(event_id) < 1) {
      return NextResponse.json({ error: 'Не указан event_id' }, { status: 400 });
    }

    db.prepare(`
      DELETE FROM bookmarks WHERE user_id = ? AND event_id = ?
    `).run(user.id, event_id);

    return NextResponse.json({ bookmarked: false, message: 'Удалено из избранного' });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Delete bookmark error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении' }, { status: 500 });
  }
}
