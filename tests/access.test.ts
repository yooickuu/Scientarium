import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';

const temp = mkdtempSync(path.join(tmpdir(), 'scientarium-test-'));
const ownerEmail = 'owner@example.test';
const password = randomBytes(24).toString('hex');
let server: ChildProcess;
let db: typeof import('../src/lib/db').default;
let base = '';
let logs = '';
let ownerCookie = '';
let memberCookie = '';
let memberId = 0;
let eventId = 0;

async function api(route: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string, string> = {}) {
  const res = await fetch(base + route, { method, headers: {
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...(cookie ? { cookie } : {}), ...headers,
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => null);
  return { res, data, cookie: res.headers.get('set-cookie')?.split(';')[0] || '' };
}

before(async () => {
  process.env.DATABASE_PATH = path.join(temp, 'test.db');
  process.env.OWNER_EMAIL = ownerEmail;
  db = (await import('../src/lib/db')).default;
  db.prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, 'Owner', 'admin')")
    .run(ownerEmail, await bcrypt.hash(password, 10));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '0', '-H', '127.0.0.1'], {
    cwd: process.cwd(), env: { ...process.env, JWT_SECRET: randomBytes(48).toString('hex'), APP_ORIGIN: '', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (data) => { logs += data; const match = logs.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) base = match[0]; });
  server.stderr?.on('data', (data) => { logs += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    if (base) {
      try { if ((await fetch(base + '/api/events')).ok) return; } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not start: ' + logs);
});

after(async () => {
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  db?.close();
  rmSync(temp, { recursive: true, force: true });
});

test('empty public catalogue, admin and bookmarks access, removed developer endpoint', async () => {
  const list = await api('/api/events');
  assert.deepEqual(list.data.events, []);
  assert.match(list.res.headers.get('cache-control') || '', /no-store/);
  assert.equal((await api('/api/admin/users')).res.status, 403);
  assert.equal((await api('/api/admin/stats')).res.status, 403);
  assert.equal((await api('/api/bookmarks')).res.status, 401);
  assert.equal((await api('/api/admin/developer-grant', 'POST', {})).res.status, 404);
  assert.equal((await api('/api/auth/logout')).res.status, 405);
});

test('invalid input and cross-site registration are rejected', async () => {
  assert.equal((await api('/api/auth/register', 'POST', null)).res.status, 400);
  assert.equal((await api('/api/auth/register', 'POST', { email: 123 })).res.status, 400);
  assert.equal((await api('/api/auth/register', 'POST', { email: 'bad', password, full_name: 'User' })).res.status, 400);
  assert.equal((await api('/api/auth/register', 'POST', { email: 'user@example.test', password: 'short', full_name: 'User' })).res.status, 400);
  assert.equal((await api('/api/auth/register', 'POST', {}, '', { origin: 'https://untrusted.example' })).res.status, 403);
  assert.equal((await api('/api/auth/login', 'POST', { email: 'a'.repeat(20_000) })).res.status, 400);
});

test('registration normalizes email, ignores supplied role, sets secure session', async () => {
  const result = await api('/api/auth/register', 'POST', { email: ' Member@Example.Test ', password, full_name: 'Member', role: 'admin' });
  assert.equal(result.res.status, 201);
  assert.equal(result.data.user.email, 'member@example.test');
  assert.equal(result.data.user.role, 'user');
  assert.equal(result.data.user.password_hash, undefined);
  assert.match(result.res.headers.get('set-cookie') || '', /HttpOnly/i);
  assert.match(result.res.headers.get('set-cookie') || '', /Secure/i);
  memberCookie = result.cookie;
  memberId = result.data.user.id;
  assert.equal((await api('/api/auth/register', 'POST', { email: 'MEMBER@example.test', password, full_name: 'Duplicate' })).res.status, 409);
  assert.equal((await api('/api/admin/users', 'PATCH', { userId: memberId, role: 'admin' }, memberCookie)).res.status, 403);
  assert.equal((await api('/api/events', 'POST', {}, memberCookie)).res.status, 403);
});

test('owner logs in and grants permissions; malformed and forged sessions are rejected', async () => {
  const login = await api('/api/auth/login', 'POST', { email: ownerEmail.toUpperCase(), password }, '', { origin: base });
  assert.equal(login.res.status, 200);
  ownerCookie = login.cookie;
  assert.equal((await api('/api/auth/me', 'GET', undefined, ownerCookie)).data.user.role, 'admin');
  assert.equal((await api('/api/admin/stats', 'GET', undefined, 'medevent_token=invalid')).res.status, 403);
  assert.equal((await api('/api/admin/users', 'PATCH', { email: 'missing@example.test', role: 'admin' }, ownerCookie)).res.status, 404);
  assert.equal((await api('/api/admin/users', 'PATCH', { email: 'member@example.test', role: 'admin' }, ownerCookie)).res.status, 200);
  assert.equal((await api('/api/admin/stats', 'GET', undefined, memberCookie)).res.status, 200);
  assert.equal((await api('/api/admin/users', 'PATCH', { email: ownerEmail, role: 'user' }, memberCookie)).res.status, 403);
  assert.equal((await api('/api/admin/users', 'PATCH', { email: ownerEmail, role: 'user' }, ownerCookie)).res.status, 403);
});

const event = { title: 'Integration event', category: 'conference', organizer_name: 'Organizer', location: 'Hall', description: 'Description', start_date: '2027-01-01T10:00:00Z', end_date: '2027-01-01T12:00:00Z' };

test('admin event creation validates dates and URLs, updates and reads details', async () => {
  assert.equal((await api('/api/events', 'POST', { ...event, registration_url: 'javascript:alert(1)' }, ownerCookie)).res.status, 400);
  assert.equal((await api('/api/events', 'POST', { ...event, end_date: '2020-01-01' }, ownerCookie)).res.status, 400);
  const created = await api('/api/events', 'POST', event, ownerCookie);
  assert.equal(created.res.status, 201);
  eventId = created.data.event.id;
  assert.equal((await api(`/api/events/${eventId}`)).res.status, 200);
  assert.equal((await fetch(base + `/events/${eventId}`)).status, 200);
  assert.equal((await api(`/api/events/${eventId}`, 'PUT', { title: 'Updated' }, memberCookie)).res.status, 200);
  assert.equal((await api(`/api/events/${eventId}`)).data.event.title, 'Updated');
  assert.equal((await api(`/api/events/${eventId}invalid`)).res.status, 400);
});

test('revoked admin loses access immediately; bookmarks persist and cascade on deletion', async () => {
  assert.equal((await api('/api/admin/users', 'PATCH', { userId: memberId, role: 'user' }, ownerCookie)).res.status, 200);
  assert.equal((await api('/api/admin/stats', 'GET', undefined, memberCookie)).res.status, 403);
  assert.equal((await api(`/api/events/${eventId}`, 'PUT', { title: 'Denied' }, memberCookie)).res.status, 403);
  assert.equal((await api(`/api/events/${eventId}`, 'DELETE', undefined, memberCookie)).res.status, 403);
  assert.equal((await api('/api/bookmarks', 'POST', { event_id: eventId }, memberCookie)).res.status, 200);
  assert.equal((await api('/api/bookmarks', 'GET', undefined, memberCookie)).data.events.length, 1);
  assert.equal((await api('/api/bookmarks', 'POST', { event_id: 999999 }, memberCookie)).res.status, 404);
  assert.equal((await api(`/api/events/${eventId}`, 'DELETE', undefined, ownerCookie)).res.status, 200);
  assert.deepEqual((await api('/api/bookmarks', 'GET', undefined, memberCookie)).data.events, []);
  assert.equal((await api(`/api/events/${eventId}`)).res.status, 404);
});

test('login attempts are limited and logout clears browser cookie', async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal((await api('/api/auth/login', 'POST', { email: 'unknown@example.test', password })).res.status, 401);
  }
  const limited = await api('/api/auth/login', 'POST', { email: 'unknown@example.test', password });
  assert.equal(limited.res.status, 429);
  assert.ok(Number(limited.res.headers.get('retry-after')) > 0);
  const logout = await api('/api/auth/logout', 'POST', undefined, ownerCookie);
  assert.equal(logout.res.status, 200);
  assert.match(logout.res.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);
});

test('moderators manage only own events and cannot manage users, universities or owner', async () => {
  assert.equal((await api('/api/admin/users','PATCH',{userId:memberId,role:'moderator'},ownerCookie)).res.status,200);
  assert.equal((await api('/api/auth/me','GET',undefined,memberCookie)).data.user.role,'moderator');
  const own=await api('/api/events','POST',event,memberCookie);
  const other=await api('/api/events','POST',{...event,title:'Owner event'},ownerCookie);
  assert.equal(own.res.status,201);assert.equal(other.res.status,201);
  const modId=own.data.event.id;const ownerEvent=other.data.event.id;
  assert.equal((await api(`/api/events/${modId}`,'PUT',{title:'Moderator edit'},memberCookie)).res.status,200);
  assert.equal((await api(`/api/events/${ownerEvent}`,'PUT',{title:'Denied'},memberCookie)).res.status,403);
  assert.equal((await api(`/api/events/${ownerEvent}`,'DELETE',undefined,memberCookie)).res.status,403);
  assert.equal((await api('/api/events?manage=1','GET',undefined,memberCookie)).data.events.length,1);
  assert.equal((await api('/api/events?manage=1','GET',undefined,ownerCookie)).data.events.length,2);
  for(const path of ['/api/admin/users','/api/admin/stats','/api/universities?manage=1'])assert.equal((await api(path,'GET',undefined,memberCookie)).res.status,403);
  assert.equal((await api('/api/admin/users','PATCH',{email:ownerEmail,role:'moderator'},ownerCookie)).res.status,403);
  await api(`/api/events/${modId}`,'DELETE',undefined,ownerCookie);await api(`/api/events/${ownerEvent}`,'DELETE',undefined,ownerCookie);
  assert.equal((await api('/api/admin/users','PATCH',{userId:memberId,role:'user'},ownerCookie)).res.status,200);
});

test('profile nickname cooldown, category, avatar validation and role escalation protection',async()=>{
  let result=await api('/api/profile','PATCH',{nickname:'Member_one',account_category:'doctor',role:'admin'},memberCookie);
  assert.equal(result.res.status,200);assert.equal(result.data.user.nickname,'member_one');assert.equal(result.data.user.account_category,'doctor');assert.equal(result.data.user.role,'user');
  result=await api('/api/profile','PATCH',{nickname:'member_two'},memberCookie);
  assert.equal(result.res.status,409);assert.equal(result.data.code,'nicknameCooldown');
  assert.equal((await api('/api/profile','PATCH',{nickname:'member_one'},ownerCookie)).res.status,409);
  assert.equal((await api('/api/profile','PATCH',{avatar_url:'data:image/svg+xml;base64,PHN2Zz4='},memberCookie)).res.status,400);
  db.prepare('UPDATE users SET nickname_changed_at=? WHERE id=?').run(new Date(Date.now()-31*86400000).toISOString(),memberId);
  assert.equal((await api('/api/profile','PATCH',{nickname:'member_two'},memberCookie)).res.status,200);
  assert.equal((await api('/api/profile','PATCH',{full_name:'Anonymous'})).res.status,401);
});

test('university CRUD, event translations, localized pages and analytics deduplication',async()=>{
  const university={name:'University test',name_kk:'Университет',name_en:'Test University',country:'KZ',city:'City',website:'https://example.com',relationship:'partner',is_active:true};
  assert.equal((await api('/api/universities','POST',university,memberCookie)).res.status,403);
  const created=await api('/api/universities','POST',university,ownerCookie);assert.equal(created.res.status,201);const id=created.data.university.id;
  assert.equal((await api('/api/universities','POST',university,ownerCookie)).res.status,409);
  const translation={en:{title:'English event',description:'English description',id:999},kk:{title:'Қазақша іс-шара'}};
  const ev=await api('/api/events','POST',{...event,university_id:id,translations_json:JSON.stringify(translation)},ownerCookie);
  assert.equal(ev.res.status,201);const eid=ev.data.event.id;assert.equal(ev.data.event.university,university.name);assert.equal(JSON.parse(ev.data.event.translations_json).en.id,undefined);
  for(const locale of ['ru','kk','en']){const response=await fetch(base+'/',{headers:{cookie:'scientarium_locale='+locale}});assert.equal(response.status,200);assert.match(await response.text(),new RegExp('<html lang="'+locale+'"'));}
  const english=await fetch(base+'/events/'+eid,{headers:{cookie:'scientarium_locale=en'}});assert.match(await english.text(),/English event/);
  const view={path:'/events/'+eid,view_id:randomBytes(16).toString('hex'),device:'mobile'};
  assert.equal((await api('/api/analytics','POST',view)).data.counted,true);
  assert.equal((await api('/api/analytics','POST',view)).data.counted,false);
  assert.equal((await api('/api/analytics','POST',{...view,view_id:randomBytes(16).toString('hex')},ownerCookie)).data.counted,false);
  const stats=await api('/api/admin/stats','GET',undefined,ownerCookie);assert.equal(stats.data.stats.pageViews,1);assert.equal(stats.data.stats.mobileViews,1);
  assert.equal((await api('/api/events/'+eid)).data.event.views_count,1);
  assert.equal((await api('/api/universities/'+id,'PUT',{...university,name:'Updated University',is_active:false},ownerCookie)).res.status,200);
  assert.equal((await api('/api/universities')).data.universities.length,0);
  assert.equal((await api('/api/events/'+eid)).data.event.university,'Updated University');
  assert.equal((await api('/api/universities/'+id,'DELETE',undefined,ownerCookie)).res.status,200);
  assert.equal((await api('/api/events/'+eid)).data.event.university_id,null);
  await api('/api/events/'+eid,'DELETE',undefined,ownerCookie);
});
