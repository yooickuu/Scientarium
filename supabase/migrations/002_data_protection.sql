-- Apply once to scientarium after 001. Additive migration: no existing data is removed.
begin;
create table scientarium_private.revisions (
 id bigint generated always as identity primary key,
 table_name text not null,record_id bigint not null,operation text not null,
 row_data jsonb not null,related_bookmarks jsonb not null default '[]',
 created_at timestamptz not null default now(),restored_at timestamptz
);
create index revisions_lookup on scientarium_private.revisions(table_name,record_id,created_at desc);
create table scientarium_private.backups (
 id bigint generated always as identity primary key,created_at timestamptz not null default now(),payload jsonb not null
);
alter table scientarium_private.revisions enable row level security;
alter table scientarium_private.backups enable row level security;
revoke all on scientarium_private.revisions,scientarium_private.backups from public,anon,authenticated;

create function scientarium_private.capture_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare saved jsonb=to_jsonb(old); related jsonb='[]';
begin
 if tg_op='UPDATE' and (saved-'views_count')=(to_jsonb(new)-'views_count') then return new; end if;
 if tg_table_name='events' and tg_op='DELETE' then
  select coalesce(jsonb_agg(to_jsonb(b)),'[]') into related from public.bookmarks b where event_id=old.id;
 end if;
 insert into scientarium_private.revisions(table_name,record_id,operation,row_data,related_bookmarks)
 values(tg_table_name,old.id,tg_op,saved,related);
 delete from scientarium_private.revisions where created_at<now()-interval '30 days';
 -- Keep up to five versions per record so uploaded images do not grow without limit.
 delete from scientarium_private.revisions where id in (
  select id from scientarium_private.revisions where table_name=tg_table_name and record_id=old.id order by id desc offset 5
 );
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger scientarium_event_history before update or delete on public.events for each row execute function scientarium_private.capture_revision();
create trigger scientarium_university_history before update or delete on public.universities for each row execute function scientarium_private.capture_revision();
create trigger scientarium_profile_history before update or delete on public.profiles for each row execute function scientarium_private.capture_revision();

create function scientarium_private.application_backup() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tables jsonb='{}'; name text; data jsonb;
begin
 foreach name in array array['public.profiles','public.events','public.universities','public.bookmarks','scientarium_private.visits','scientarium_private.legacy_profiles','scientarium_private.legacy_event_authors','scientarium_private.legacy_bookmarks'] loop
  if to_regclass(name) is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from %s t',to_regclass(name)) into data;
   tables=tables||jsonb_build_object(name,data);
  end if;
 end loop;
 return jsonb_build_object('format','scientarium-application-backup-v1','created_at',now(),'tables',tables,
 'limitations','Application data only. Auth passwords, sessions and Storage objects are not included.');
end $$;
create function scientarium_private.create_daily_backup() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(648203);
 insert into scientarium_private.backups(payload) values(scientarium_private.application_backup());
 delete from scientarium_private.backups where id not in(select id from scientarium_private.backups order by id desc limit 3);
 delete from scientarium_private.revisions where created_at<now()-interval '30 days';
end $$;
create function public.backup_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=scientarium_private.my_id() and is_owner) then raise exception 'forbidden'; end if;
 return jsonb_build_object('last_backup_at',(select max(created_at) from scientarium_private.backups),
 'snapshots',(select count(*) from scientarium_private.backups),
 'deleted',coalesce((select jsonb_agg(to_jsonb(r) order by r.id desc) from
 (select id,table_name,record_id,created_at,coalesce(row_data->>'title',row_data->>'name','') as title from scientarium_private.revisions
 where operation='DELETE' and table_name in ('events','universities') and restored_at is null and created_at>=now()-interval '30 days' order by id desc limit 100)r),'[]'::jsonb));
end $$;
create function public.download_backup(snapshot_id bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=scientarium_private.my_id() and is_owner) then raise exception 'forbidden'; end if;
 if snapshot_id is null then return scientarium_private.application_backup(); end if;
 select payload into result from scientarium_private.backups where id=snapshot_id;
 if not found then raise exception 'notFound'; end if;
 return result;
end $$;
create function public.restore_deleted_record(revision_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare r scientarium_private.revisions; e public.events; u public.universities;
begin
 if not exists(select 1 from public.profiles where id=scientarium_private.my_id() and is_owner) then raise exception 'forbidden'; end if;
 select * into r from scientarium_private.revisions where id=revision_id and operation='DELETE' and restored_at is null and created_at>=now()-interval '30 days' for update;
 if not found then raise exception 'notFound'; end if;
 if r.table_name='events' then
  e=jsonb_populate_record(null::public.events,r.row_data);
  if exists(select 1 from public.events where id=e.id) then raise exception 'alreadyExists'; end if;
  if not exists(select 1 from public.universities where id=e.university_id) then e.university_id=null; end if;
  if not exists(select 1 from public.profiles where id=e.created_by) then e.created_by=null; end if;
  insert into public.events select (e).*;
  insert into public.bookmarks(user_id,event_id,created_at)
   select b.user_id,e.id,b.created_at from jsonb_populate_recordset(null::public.bookmarks,r.related_bookmarks)b
   where exists(select 1 from public.profiles p where p.id=b.user_id) on conflict do nothing;
 elsif r.table_name='universities' then
  u=jsonb_populate_record(null::public.universities,r.row_data);
  if exists(select 1 from public.universities where id=u.id or name_key=lower(btrim(u.name))) then raise exception 'alreadyExists'; end if;
  insert into public.universities(id,name,name_kk,name_en,country,city,website,description,relationship,is_active,created_at)
   values(u.id,u.name,u.name_kk,u.name_en,u.country,u.city,u.website,u.description,u.relationship,u.is_active,u.created_at);
 else raise exception 'forbidden'; end if;
 update scientarium_private.revisions set restored_at=now() where id=r.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function scientarium_private.capture_revision(),scientarium_private.application_backup(),scientarium_private.create_daily_backup(),public.backup_status(),public.download_backup(bigint),public.restore_deleted_record(bigint) from public,anon,authenticated;
grant execute on function public.backup_status(),public.download_backup(bigint),public.restore_deleted_record(bigint) to authenticated;
select scientarium_private.create_daily_backup();
-- Supabase scheduler (excluded only in local PostgreSQL/WASM tests).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('scientarium-daily-backup','15 22 * * *','select scientarium_private.create_daily_backup()');
commit;
