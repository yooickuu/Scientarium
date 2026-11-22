import { loadEnvConfig } from '@next/env';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

loadEnvConfig(process.cwd());

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set OWNER_EMAIL in .env.local or server environment first.');
  const db = (await import('../src/lib/db')).default;
  // Never silently replace a registered account or its password.
  if (db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)) {
    throw new Error('Owner email already exists. No account or password was changed.');
  }
  const dir = path.resolve('private');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const credentialPath = path.join(dir, 'developer-access.txt');
  if (existsSync(credentialPath)) throw new Error('Credential file already exists. Move it to a password manager before provisioning another owner.');
  const password = randomBytes(24).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  db.transaction(() => {
    db.prepare(`INSERT INTO users (email, password_hash, full_name, role, university, specialty)
      VALUES (?, ?, ?, 'admin', '', '')`).run(email, hash, 'Разработчик Scientarium');
    writeFileSync(credentialPath, `Scientarium — доступ владельца\n\nEmail: ${email}\nПароль: ${password}\n\nВойдите через обычную форму входа. Управление пользователями: /admin.\nСохраните пароль в менеджере паролей и удалите этот файл.\nЭто локальный аккаунт; на хостинге он ещё не создан.\n`, { flag: 'wx', mode: 0o600 });
  })();
  console.log('Owner account created. Credentials saved in private/developer-access.txt (not printed).');
  db.close();
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
