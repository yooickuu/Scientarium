import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'medevents.db'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __medevents_db: Database.Database | undefined;
}

function getDatabase(): Database.Database {
  if (global.__medevents_db) {
    return global.__medevents_db;
  }

  const db = new Database(DB_PATH, { timeout: 15000 });
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 15000');
    db.pragma('foreign_keys = ON');

    // Serialize migrations across Next build/server workers.
    db.transaction(() => {
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        is_active INTEGER NOT NULL DEFAULT 1,
        university TEXT DEFAULT '',
        specialty TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('conference', 'training', 'masterclass', 'webinar', 'olympiad', 'snk', 'other')),
        organizer_name TEXT NOT NULL,
        university TEXT NOT NULL DEFAULT 'Все',
        specialty TEXT NOT NULL DEFAULT 'Общая медицина',
        format TEXT NOT NULL DEFAULT 'offline' CHECK(format IN ('offline', 'online', 'hybrid')),
        city TEXT NOT NULL DEFAULT 'Караганда',
        location TEXT NOT NULL,
        online_url TEXT DEFAULT '',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        description TEXT NOT NULL,
        program TEXT DEFAULT '',
        speakers TEXT DEFAULT '',
        target_audience TEXT DEFAULT '',
        price_type TEXT NOT NULL DEFAULT 'free' CHECK(price_type IN ('free', 'paid')),
        price TEXT DEFAULT 'Бесплатно',
        registration_url TEXT DEFAULT '',
        contact_info TEXT DEFAULT '',
        image_url TEXT DEFAULT '',
        is_featured INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER,
        views_count INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, event_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
      );
    `);

    const columns = db.pragma('table_info(users)') as { name: string }[];
    if (!columns.some((column) => column.name === 'is_active')) {
      db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }
    const userMigrations: Record<string, string> = {
      nickname: 'TEXT', nickname_changed_at: 'TEXT', avatar_url: "TEXT NOT NULL DEFAULT ''",
      account_category: "TEXT NOT NULL DEFAULT 'unspecified'", is_moderator: 'INTEGER NOT NULL DEFAULT 0'
    };
    for (const [name, definition] of Object.entries(userMigrations)) {
      if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_unique ON users(nickname COLLATE NOCASE) WHERE nickname IS NOT NULL AND nickname <> '';
      CREATE TABLE IF NOT EXISTS universities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
        name_kk TEXT NOT NULL DEFAULT '', name_en TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
        relationship TEXT NOT NULL DEFAULT 'participant' CHECK(relationship IN ('partner','participant')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS analytics_visits (
        view_id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, path TEXT NOT NULL,
        day TEXT NOT NULL, device TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS analytics_day ON analytics_visits(day);
      CREATE INDEX IF NOT EXISTS analytics_session_time ON analytics_visits(session_hash, created_at);
    `);
    const eventColumns = db.pragma('table_info(events)') as { name: string }[];
    if (!eventColumns.some((column) => column.name === 'university_id')) db.exec('ALTER TABLE events ADD COLUMN university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL');
    if (!eventColumns.some((column) => column.name === 'translations_json')) db.exec("ALTER TABLE events ADD COLUMN translations_json TEXT NOT NULL DEFAULT '{}'");
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_nocase ON users(email COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS events_start_date ON events(start_date);
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_rate_expiry ON auth_rate_limits(expires_at);
    `);

    }).immediate();
  } catch (err) {
    db.close();
    throw err;
  }

  global.__medevents_db = db;
  return db;
}

const db = getDatabase();

export default db;
