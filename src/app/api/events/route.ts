import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { MedicalEvent } from '@/types';
import { parseEvent } from '@/lib/event-validation';
import { EVENT_FIELDS, eventById } from '@/lib/events-store';
import { guardMutation, readJson, InputError } from '@/lib/request-security';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams;
    const user = await getCurrentUser();
    const conditions: string[] = [];
    const values: (string | number)[] = [user?.id || -1];
    if (query.get('manage') === '1') {
      if (!user || user.role === 'user') return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
      if (user.role === 'moderator') { conditions.push('e.created_by = ?'); values.push(user.id); }
    }
    const search = query.get('search')?.trim();
    if (search) { conditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.speakers LIKE ? OR e.organizer_name LIKE ? OR e.translations_json LIKE ?)'); values.push(...Array(5).fill(`%${search.slice(0,200)}%`)); }
    for (const field of ['category','format','city','university']) {
      const value = query.get(field);
      if (value && value !== 'all') { conditions.push(`e.${field} = ?`); values.push(value); }
    }
    const universityId = Number(query.get('university_id'));
    if (Number.isSafeInteger(universityId) && universityId > 0) { conditions.push('e.university_id = ?'); values.push(universityId); }
    if (query.get('featured') === '1') conditions.push('e.is_featured=1');
    if (query.get('timeFilter') === 'upcoming') { conditions.push('e.end_date>=?'); values.push(new Date().toISOString()); }
    if (query.get('timeFilter') === 'past') { conditions.push('e.end_date<?'); values.push(new Date().toISOString()); }
    const rows = db.prepare(`SELECT e.*, u.full_name AS author_name,
      EXISTS(SELECT 1 FROM bookmarks b WHERE b.event_id=e.id AND b.user_id=?) AS is_bookmarked
      FROM events e LEFT JOIN users u ON u.id=e.created_by
      ${conditions.length ? 'WHERE '+conditions.join(' AND ') : ''} ORDER BY e.start_date ASC`).all(...values) as MedicalEvent[];
    return NextResponse.json({ events: rows.map(row => ({ ...row, is_featured: Boolean(row.is_featured), is_bookmarked: Boolean(row.is_bookmarked) })) });
  } catch { return NextResponse.json({ error: 'Не удалось загрузить события' }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const blocked = guardMutation(req); if (blocked) return blocked;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Необходим вход' }, { status: 401 });
    if (user.role === 'user') return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    const body = parseEvent(await readJson(req, 2 * 1024 * 1024));
    const defaults: Record<string, unknown> = { organizer_name: '', university: '', specialty: '', format: 'offline', city: '', online_url: '', program: '', speakers: '', target_audience: '', price_type: 'free', price: '', registration_url: '', contact_info: '', image_url: '', university_id: null, translations_json: '{}' };
    const values = EVENT_FIELDS.map(field => field === 'is_featured' ? (body[field] ? 1 : 0) : body[field] ?? defaults[field]);
    const result = db.prepare(`INSERT INTO events (${EVENT_FIELDS.join(',')},slug,created_by) VALUES (${[...EVENT_FIELDS,'slug','created_by'].map(()=>'?').join(',')})`).run(...values, randomUUID(), user.id);
    return NextResponse.json({ event: eventById(Number(result.lastInsertRowid), user.id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.message : 'Ошибка сохранения' }, { status: error instanceof InputError ? 400 : 500 });
  }
}
