import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
  const failures: string[] = [];
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) failures.push('JWT_SECRET: at least 32 random bytes required');
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) failures.push('OWNER_EMAIL is required');
  try {
    const origin = new URL(process.env.APP_ORIGIN || '');
    if (origin.protocol !== 'https:' || origin.origin !== process.env.APP_ORIGIN) throw new Error();
  } catch { failures.push('APP_ORIGIN must be the canonical HTTPS origin without a trailing slash'); }
  if (!process.env.DATABASE_PATH) failures.push('DATABASE_PATH must point to persistent storage (SQLite cannot run on ephemeral serverless storage)');
  const db = (await import('../src/lib/db')).default;
  if (owner && !db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND role = 'admin' AND is_active = 1").get(owner)) failures.push('The protected owner account is missing');
  const demo = db.prepare("SELECT COUNT(*) AS count FROM users WHERE email IN ('admin@scientarium.kz', 'admin@medevent.kz', 'user@scientarium.kz')").get() as { count: number };
  if (demo.count) failures.push('Remove old demo accounts before launch');
  db.close();
  if (failures.length) {
    console.error('Not ready for public deployment:\n' + failures.map((item) => `- ${item}`).join('\n'));
    process.exitCode = 1;
  } else console.log('Local configuration checks passed. Hosting, backups, email recovery and live HTTPS QA still require verification.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
