import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import db from './db';
import { User, UserRole } from '@/types';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes. Configure .env.local or hosting secrets.');
  }
  return secret;
}
export const PUBLIC_USER_COLUMNS = `id, email, full_name,
  CASE WHEN role = 'admin' THEN 'admin' WHEN is_moderator = 1 THEN 'moderator' ELSE 'user' END AS role,
  university, specialty, created_at, nickname, nickname_changed_at, avatar_url, account_category`;

export function publicUser(row: User): User {
  return { ...row, is_owner: row.email.toLowerCase() === process.env.OWNER_EMAIL?.trim().toLowerCase() };
}

const TOKEN_COOKIE = 'medevent_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: number; email: string; role: UserRole }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d', algorithm: 'HS256', issuer: 'scientarium', audience: 'scientarium-web' }
  );
}

export function verifyToken(token: string): { id: number; email: string; role: UserRole } | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], issuer: 'scientarium', audience: 'scientarium-web' }) as { id: number; email: string; role: UserRole };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE)?.value;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const row = db.prepare(`
      SELECT ${PUBLIC_USER_COLUMNS} 
      FROM users WHERE id = ? AND is_active = 1
    `).get(payload.id) as User | undefined;

    return row ? publicUser(row) : null;
  } catch {
    return null;
  }
}

export { TOKEN_COOKIE };
