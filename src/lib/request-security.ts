import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import db from './db';

export function guardMutation(req: NextRequest, json = true): NextResponse | null {
  const origin = req.headers.get('origin');
  // Next may normalize req.url to localhost when listening on 127.0.0.1.
  // Use the actual browser-facing Host locally; production sets APP_ORIGIN.
  const requestUrl = new URL(req.url);
  const expectedOrigin = process.env.APP_ORIGIN || `${requestUrl.protocol}//${req.headers.get('host') || requestUrl.host}`;
  if ((origin && origin !== expectedOrigin) || req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Запрос с другого сайта отклонён' }, { status: 403 });
  }
  if (json && req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return NextResponse.json({ error: 'Ожидается JSON' }, { status: 415 });
  }
  return null;
}

export class InputError extends Error {}

export async function readJson(req: NextRequest, maxBytes = 16_384): Promise<Record<string, unknown>> {
  if (!req.body) throw new InputError('Пустой запрос');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new InputError('Слишком большой запрос');
    }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new InputError('Некорректный JSON');
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// Stored in SQLite so limits survive restarts and are shared by local workers.
// Do not trust arbitrary X-Forwarded-For headers as a visitor identity.
export function limitAuth(action: 'login' | 'register', email: string): NextResponse | null {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const keys: [string, number][] = [
    [`${action}:global`, action === 'login' ? 300 : 50],
    [`${action}:${createHash('sha256').update(email).digest('hex')}`, action === 'login' ? 10 : 5],
  ];
  const blocked = db.transaction(() => {
    db.prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?').run(now);
    for (const [key, limit] of keys) {
      const row = db.prepare('SELECT attempts, expires_at FROM auth_rate_limits WHERE key = ?').get(key) as { attempts: number; expires_at: number } | undefined;
      if (row && row.attempts >= limit) return Math.ceil((row.expires_at - now) / 1000);
    }
    const increment = db.prepare(`INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`);
    for (const [key] of keys) increment.run(key, now + windowMs);
    return 0;
  })();
  return blocked ? NextResponse.json(
    { error: 'Слишком много попыток. Попробуйте позже.' },
    { status: 429, headers: { 'Retry-After': String(blocked) } },
  ) : null;
}
