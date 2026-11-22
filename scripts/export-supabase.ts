import {loadEnvConfig} from '@next/env';
import Database from 'better-sqlite3';
import {mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import path from 'node:path';
loadEnvConfig(process.cwd());
const source=path.resolve(process.env.DATABASE_PATH||'data/medevents.db');
const db=new Database(source,{readonly:true,fileMustExist:true});
const snapshot=db.transaction(()=>({users:db.prepare('select * from users order by id').all() as any[],events:db.prepare('select * from events order by id').all() as any[],universities:db.prepare('select * from universities order by id').all() as any[],bookmarks:db.prepare('select * from bookmarks').all() as any[]}))();db.close();
const quote=(value:unknown):string=>value==null?'NULL':typeof value==='boolean'?(value?'TRUE':'FALSE'):typeof value==='number'?String(value):"'"+String(value).replace(/'/g,"''")+"'";
const insert=(table:string,record:Record<string,unknown>)=>`INSERT INTO ${table} (${Object.keys(record).map(k=>'"'+k+'"').join(',')}) VALUES (${Object.values(record).map(quote).join(',')});`;
const sql=["-- PRIVATE: personal data. Do not upload to GitHub. No passwords or password hashes.\n-- Run once AFTER 001_scientarium.sql, in the new scientarium project only.\nbegin;\nset local standard_conforming_strings=on;\nDO $$begin if exists(select 1 from public.events) or exists(select 1 from public.universities) then raise exception 'Destination contains content: review before importing'; end if;end$$;",readFileSync('supabase/restore-legacy.sql','utf8')];
const owner=process.env.OWNER_EMAIL?.trim().toLowerCase();
for(const u of snapshot.users){
 const isOwner=u.email.toLowerCase()===owner;
 const payload={full_name:u.full_name,role:isOwner?'admin':u.role==='admin'?'admin':u.is_moderator?'moderator':'user',is_owner:isOwner,is_active:Boolean(u.is_active),university:u.university||'',specialty:u.specialty||'',nickname:u.nickname||null,nickname_changed_at:u.nickname_changed_at||null,avatar_url:u.avatar_url||'',account_category:u.account_category||'unspecified',created_at:u.created_at};
 sql.push(insert('scientarium_private.legacy_profiles',{legacy_id:u.id,email:u.email.toLowerCase(),payload:JSON.stringify(payload)}));
}
for(const row of snapshot.universities){const {name_key,...u}=row;sql.push(insert('public.universities',{...u,is_active:Boolean(u.is_active)}));}
for(const e of snapshot.events){
 sql.push(insert('public.events',{...e,created_by:null,is_featured:Boolean(e.is_featured)}));
 if(e.created_by)sql.push(insert('scientarium_private.legacy_event_authors',{event_id:e.id,legacy_user_id:e.created_by}));
}
for(const b of snapshot.bookmarks)sql.push(insert('scientarium_private.legacy_bookmarks',{legacy_user_id:b.user_id,event_id:b.event_id}));
for(const table of ['events','universities'])sql.push(`SELECT setval(pg_get_serial_sequence('public.${table}','id'),GREATEST(COALESCE((SELECT MAX(id) FROM public.${table}),0),1),EXISTS(SELECT 1 FROM public.${table}));`);
sql.push('SELECT scientarium_private.restore_profile(id) FROM auth.users WHERE email_confirmed_at IS NOT NULL;','commit;');
mkdirSync('private',{recursive:true,mode:0o700});
writeFileSync('private/import-to-supabase.sql',sql.join('\n')+'\n',{mode:0o600});chmodSync('private/import-to-supabase.sql',0o600);
writeFileSync('private/supabase-import-summary.json',JSON.stringify({createdAt:new Date().toISOString(),source,counts:{users:snapshot.users.length,events:snapshot.events.length,universities:snapshot.universities.length,bookmarks:snapshot.bookmarks.length},emails:snapshot.users.map(u=>u.email),note:'Create or register cloud accounts using the same verified email. Passwords are not copied; profile, roles and bookmarks are restored after confirmation.'},null,2),{mode:0o600});
console.log('Prepared private/import-to-supabase.sql. Source unchanged. Counts:',{users:snapshot.users.length,events:snapshot.events.length,universities:snapshot.universities.length,bookmarks:snapshot.bookmarks.length});
