import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids={owner:'00000000-0000-4000-8000-000000000001',mod:'00000000-0000-4000-8000-000000000002',user:'00000000-0000-4000-8000-000000000003',other:'00000000-0000-4000-8000-000000000004'};
async function as(who,sql,args=[]){return db.transaction(async tx=>{
 await tx.exec(`set local role ${who?'authenticated':'anon'}`);
 await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[who]||'']);
 return (await tx.query(sql,args)).rows;
});}
const rpc=async(who,name,args=[],slots=args.map((_,i)=>'$'+(i+1)).join(','))=>(await as(who,`select public.${name}(${slots}) as result`,args))[0].result;
const event={title:'Conference',category:'conference',location:'Hall',description:'Scientific meeting',start_date:'2027-01-01T10:00:00Z',end_date:'2027-01-01T12:00:00Z'};
let ownerEvent,modEvent;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 try{await db.exec(await readFile(new URL('../../supabase/migrations/001_scientarium.sql',import.meta.url),'utf8'));}catch(e){throw new Error(e.message+' at '+e.position+' '+(e.where||''));}
 for(const [name,id] of Object.entries(ids))await db.query("insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,now())",[id,name+'@example.test',JSON.stringify({full_name:name,role:'admin',is_owner:true})]);
 await db.exec("update public.profiles set role='admin',is_owner=true where email='owner@example.test';update public.profiles set role='moderator' where email='mod@example.test'");
});
after(()=>db.close());
test('Anonymous visitors cannot read profiles or invoke privileged functions; signup metadata cannot grant roles',async()=>{
 assert.equal((await rpc('user','get_my_profile')).role,'user');
 await assert.rejects(as(null,'select * from public.profiles'),/permission denied/);
 await assert.rejects(rpc(null,'admin_users'),/permission denied/);
 await assert.rejects(rpc('user','admin_users'),/forbidden/);
 assert.deepEqual(await as(null,'select * from public.events'),[]);
 await assert.rejects(as('user',"update public.profiles set role='admin'"),/permission denied/);
});
test('Profile whitelist, unique nickname, server cooldown and image validation',async()=>{
 const profile=await rpc('user','update_profile',[JSON.stringify({nickname:'student_1',role:'admin',is_owner:true,account_category:'doctor'})]);
 assert.equal(profile.role,'user');assert.equal(profile.is_owner,false);assert.equal(profile.account_category,'doctor');
 await assert.rejects(rpc('user','update_profile',[JSON.stringify({nickname:'student_2'})]),/nicknameCooldown/);
 await assert.rejects(rpc('other','update_profile',[JSON.stringify({nickname:'student_1'})]),/nicknameTaken/);
 await assert.rejects(rpc('user','update_profile',[JSON.stringify({avatar_url:'data:image/png;base64,AAAA'})]),/imageError/);
});
test('Moderator can only mutate own events, cannot spoof author or delete orphaned events',async()=>{
 ownerEvent=await rpc('owner','save_event',[null,JSON.stringify(event)]);
 const mod=await rpc('mod','get_my_profile');
 modEvent=await rpc('mod','save_event',[null,JSON.stringify({...event,created_by:ownerEvent.created_by,views_count:999})]);
 assert.equal(modEvent.created_by,mod.id);assert.equal(modEvent.views_count,0);
 await rpc('mod','save_event',[modEvent.id,JSON.stringify({title:'Updated'})]);
 await assert.rejects(rpc('mod','save_event',[ownerEvent.id,JSON.stringify({title:'Hijacked'})]),/forbidden/);
 await assert.rejects(rpc('user','save_event',[null,JSON.stringify(event)]),/forbidden/);
 await assert.rejects(rpc('mod','delete_event',[ownerEvent.id]),/forbidden/);
 await db.query('update public.events set created_by=null where id=$1',[ownerEvent.id]);
 await assert.rejects(rpc('mod','delete_event',[ownerEvent.id]),/forbidden/);
 await assert.rejects(rpc('owner','save_event',[ownerEvent.id,JSON.stringify({online_url:'javascript:alert(1)'})]),/invalidInput/);
 await assert.rejects(as('mod',"update public.events set views_count=999"),/permission denied/);
});
test('Admin roles are live; owner is protected and users cannot manage universities',async()=>{
 await assert.rejects(rpc('mod','set_user_role',['user@example.test','admin']),/forbidden/);
 await assert.rejects(rpc('owner','set_user_role',['owner@example.test','moderator']),/ownerProtected/);
 await rpc('owner','set_user_role',['other@example.test','moderator']);assert.equal((await rpc('other','get_my_profile')).role,'moderator');
 await rpc('owner','set_user_role',['other@example.test','user']);
 const uni=await rpc('owner','save_university',[null,JSON.stringify({name:'Medical University',is_active:true})]);
 await rpc('owner','save_event',[ownerEvent.id,JSON.stringify({university_id:uni.id})]);
 await rpc('owner','save_university',[uni.id,JSON.stringify({name:'Renamed University',is_active:false})]);
 assert.equal((await as(null,'select * from public.universities')).length,0);
 assert.equal((await as('owner','select * from public.universities')).length,1);
 await assert.rejects(rpc('mod','save_university',[null,JSON.stringify({name:'No'})]),/forbidden/);
 await rpc('owner','delete_university',[uni.id]);
 const row=(await as(null,'select university,university_id from public.events where id=$1',[ownerEvent.id]))[0];
 assert.equal(row.university_id,null);assert.equal(row.university,'Renamed University');
});
test('Bookmarks are private and analytics deduplicates visits and excludes staff',async()=>{
 const user=await rpc('user','get_my_profile');const other=await rpc('other','get_my_profile');
 await as('user','insert into public.bookmarks(user_id,event_id) values($1,$2)',[user.id,modEvent.id]);
 assert.equal((await as('other','select * from public.bookmarks')).length,0);
 await assert.rejects(as('other','insert into public.bookmarks(user_id,event_id) values($1,$2)',[user.id,ownerEvent.id]),/row-level security/);
 assert.equal((await as('user','select * from public.bookmarks')).length,1);
 const visit=['/events/'+modEvent.id,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','mobile'];
 assert.equal((await rpc(null,'record_visit',visit)).counted,true);
 assert.equal((await rpc(null,'record_visit',visit)).counted,false);
 assert.equal((await rpc('mod','record_visit',['/','33333333-3333-4333-8333-333333333333',visit[2],'desktop'])).counted,false);
 const stats=await rpc('owner','admin_stats',[7]);assert.equal(stats.pageViews,1);assert.equal(stats.sessions,1);assert.equal(stats.daily.length,7);assert.equal(stats.mobileViews,1);
 await assert.rejects(rpc('user','admin_stats',[7]),/forbidden/);
 await assert.rejects(as(null,'select * from scientarium_private.visits'),/permission denied/);
 await rpc('owner','delete_event',[modEvent.id]);assert.equal((await as('user','select * from public.bookmarks')).length,0);
});
test('Legacy profiles restore only after email confirmation, once, and stay private',async()=>{
 await db.exec(await readFile(new URL('../../supabase/restore-legacy.sql',import.meta.url),'utf8'));
 const payload={full_name:'Imported user',role:'moderator',is_owner:false,is_active:true,university:'University',specialty:'Medicine',nickname:'old_profile',nickname_changed_at:null,avatar_url:'',account_category:'doctor',created_at:'2026-01-01T00:00:00Z'};
 await db.query('insert into scientarium_private.legacy_profiles(legacy_id,email,payload) values(42,$1,$2)',['pending@example.test',JSON.stringify(payload)]);
 await db.query('insert into scientarium_private.legacy_event_authors(event_id,legacy_user_id) values($1,42)',[ownerEvent.id]);
 await db.query('insert into scientarium_private.legacy_bookmarks(legacy_user_id,event_id) values(42,$1)',[ownerEvent.id]);
 const id='00000000-0000-4000-8000-000000000099';
 await db.query('insert into auth.users(id,email) values($1,$2)',[id,'pending@example.test']);
 assert.equal((await db.query('select role from public.profiles where auth_id=$1',[id])).rows[0].role,'user');
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
 const profile=(await db.query('select * from public.profiles where auth_id=$1',[id])).rows[0];
 assert.equal(profile.role,'moderator');assert.equal(profile.nickname,'old_profile');
 assert.equal((await db.query('select created_by from public.events where id=$1',[ownerEvent.id])).rows[0].created_by,profile.id);
 assert.equal((await db.query('select * from public.bookmarks where user_id=$1',[profile.id])).rows.length,1);
 await db.query("update public.profiles set full_name='Changed' where id=$1",[profile.id]);
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
 assert.equal((await db.query('select full_name from public.profiles where id=$1',[profile.id])).rows[0].full_name,'Changed');
 await assert.rejects(as('user','select * from scientarium_private.legacy_profiles'),/permission denied/);
 await assert.rejects(as('user','select scientarium_private.restore_profile($1)',[id]),/permission denied/);
});
