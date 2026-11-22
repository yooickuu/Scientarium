-- Used by scripts/export-supabase.ts. Trusted SQL Editor import only, not a public API.
create table scientarium_private.legacy_profiles (
 legacy_id bigint primary key,email text not null unique,payload jsonb not null,claimed_by uuid unique references auth.users(id)
);
create table scientarium_private.legacy_event_authors (
 event_id bigint primary key references public.events(id) on delete cascade,
 legacy_user_id bigint not null references scientarium_private.legacy_profiles(legacy_id)
);
create table scientarium_private.legacy_bookmarks (
 legacy_user_id bigint references scientarium_private.legacy_profiles(legacy_id),
 event_id bigint references public.events(id) on delete cascade,primary key(legacy_user_id,event_id)
);
revoke all on all tables in schema scientarium_private from public,anon,authenticated;
alter table scientarium_private.legacy_profiles enable row level security;
alter table scientarium_private.legacy_event_authors enable row level security;
alter table scientarium_private.legacy_bookmarks enable row level security;
create function scientarium_private.restore_profile(auth_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare old_profile scientarium_private.legacy_profiles; cloud_profile bigint; account_email text; confirmed timestamptz; p jsonb;
begin
 select lower(email),email_confirmed_at into account_email,confirmed from auth.users where id=auth_user_id;
 if confirmed is null then return; end if;
 select * into old_profile from scientarium_private.legacy_profiles where email=account_email and claimed_by is null for update;
 if not found then return; end if;
 select id into cloud_profile from public.profiles where auth_id=auth_user_id;
 if cloud_profile is null then return; end if;
 p=old_profile.payload;
 update public.profiles set full_name=p->>'full_name',role=p->>'role',is_owner=(p->>'is_owner')::boolean,
 is_active=(p->>'is_active')::boolean,university=p->>'university',specialty=p->>'specialty',nickname=nullif(p->>'nickname',''),
 nickname_changed_at=nullif(p->>'nickname_changed_at','')::timestamptz,avatar_url=p->>'avatar_url',account_category=p->>'account_category',created_at=(p->>'created_at')::timestamptz
 where id=cloud_profile;
 update public.events set created_by=cloud_profile where id in(select event_id from scientarium_private.legacy_event_authors where legacy_user_id=old_profile.legacy_id);
 insert into public.bookmarks(user_id,event_id) select cloud_profile,event_id from scientarium_private.legacy_bookmarks where legacy_user_id=old_profile.legacy_id on conflict do nothing;
 update scientarium_private.legacy_profiles set claimed_by=auth_user_id where legacy_id=old_profile.legacy_id;
end $$;
revoke all on function scientarium_private.restore_profile(uuid) from public,anon,authenticated;
create or replace function scientarium_private.sync_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email is null then return new; end if;
 insert into public.profiles(auth_id,email,full_name)
 values(new.id,lower(new.email),left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),150))
 on conflict(auth_id) do update set email=excluded.email;
 perform scientarium_private.restore_profile(new.id);
 return new;
end $$;
revoke all on function scientarium_private.sync_auth_user() from public,anon,authenticated;
drop trigger scientarium_auth_user on auth.users;
create trigger scientarium_auth_user after insert or update of email,email_confirmed_at on auth.users for each row execute function scientarium_private.sync_auth_user();
