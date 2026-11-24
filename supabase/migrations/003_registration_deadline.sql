-- Run in the Scientarium Supabase SQL Editor. Existing events keep no deadline.
begin;
alter table public.events add column if not exists registration_deadline timestamptz;
create or replace function public.save_event(event_id bigint,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor bigint=scientarium_private.my_id(); actor_role text=scientarium_private.my_role(); old_event public.events; e public.events; item record; clean jsonb; tr jsonb; lang text; field text; sanitized jsonb='{}'; lang_content jsonb; uni text;
begin
 if actor is null then raise exception 'loginRequired'; end if;
 if actor_role not in ('admin','moderator') then raise exception 'forbidden'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>2100000 then raise exception 'invalidInput'; end if;
 if event_id is not null then
  select * into old_event from public.events where id=event_id for update;
  if not found then raise exception 'notFound'; end if;
  if actor_role<>'admin' and old_event.created_by is distinct from actor then raise exception 'forbidden'; end if;
 end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into clean from jsonb_each(payload)
 where key in ('title','category','organizer_name','university','university_id','specialty','format','city','location','online_url','start_date','end_date','description','program','speakers','target_audience','price_type','price','registration_url','contact_info','image_url','is_featured','translations_json','registration_deadline');
 for item in select key,value from jsonb_each(clean) where key not in ('university_id','is_featured','registration_deadline') loop
  if jsonb_typeof(item.value)<>'string' then raise exception 'invalidInput'; end if;
  if length(item.value#>>'{}') > (case when item.key='image_url' then 1500000 when item.key='translations_json' then 180000 when item.key in ('description','program','speakers') then 30000 else 2000 end) then raise exception 'invalidInput'; end if;
 end loop;
 if clean ? 'is_featured' and jsonb_typeof(clean->'is_featured')<>'boolean' then raise exception 'invalidInput'; end if;
 if clean ? 'university_id' and jsonb_typeof(clean->'university_id') not in ('number','null') then raise exception 'invalidInput'; end if;
 if clean ? 'registration_deadline' and jsonb_typeof(clean->'registration_deadline') not in ('string','null') then raise exception 'invalidInput'; end if;
 if clean->>'registration_deadline'='' then clean=jsonb_set(clean,'{registration_deadline}','null'); end if;
 e=jsonb_populate_record(null::public.events,
  '{"organizer_name":"","university":"","specialty":"","format":"offline","city":"","online_url":"","program":"","speakers":"","target_audience":"","price_type":"free","price":"","registration_url":"","contact_info":"","image_url":"","is_featured":false,"translations_json":"{}"}'::jsonb
  ||case when event_id is null then '{}'::jsonb else to_jsonb(old_event) end||clean);
 if coalesce(length(btrim(e.title)),0)=0 or coalesce(length(btrim(e.description)),0)=0 or coalesce(length(btrim(e.location)),0)=0 then raise exception 'invalidInput'; end if;
 if not scientarium_private.valid_url(e.online_url) or not scientarium_private.valid_url(e.registration_url) then raise exception 'invalidInput'; end if;
 if not scientarium_private.valid_image(e.image_url,1500000) and not scientarium_private.valid_url(e.image_url) then raise exception 'imageError'; end if;
 if e.registration_deadline is not null and (not isfinite(e.registration_deadline) or e.registration_deadline>e.end_date) then raise exception 'deadlineError'; end if;
 if e.university_id is not null then
  select name into uni from public.universities where id=e.university_id and (is_active or id=old_event.university_id);
  if not found then raise exception 'invalidInput'; end if;
  e.university=uni;
 end if;
 tr=e.translations_json::jsonb;
 if jsonb_typeof(tr)<>'object' then raise exception 'invalidInput'; end if;
 foreach lang in array array['ru','kk','en'] loop
  if tr ? lang then
   if jsonb_typeof(tr->lang)<>'object' then raise exception 'invalidInput'; end if;
   lang_content='{}';
   foreach field in array array['title','description','program','speakers','target_audience','location','organizer_name','specialty'] loop
    if (tr->lang) ? field then
     if jsonb_typeof(tr->lang->field)<>'string' or length(tr->lang->>field)>30000 then raise exception 'invalidInput'; end if;
     lang_content=lang_content||jsonb_build_object(field,btrim(tr->lang->>field));
    end if;
   end loop;
   sanitized=sanitized||jsonb_build_object(lang,lang_content);
  end if;
 end loop;
 e.translations_json=sanitized::text;
 if event_id is null then
  insert into public.events(title,category,organizer_name,university,university_id,specialty,format,city,location,online_url,start_date,end_date,description,program,speakers,target_audience,price_type,price,registration_url,contact_info,image_url,is_featured,translations_json,registration_deadline,created_by)
  values(e.title,e.category,e.organizer_name,e.university,e.university_id,e.specialty,e.format,e.city,e.location,e.online_url,e.start_date,e.end_date,e.description,e.program,e.speakers,e.target_audience,e.price_type,e.price,e.registration_url,e.contact_info,e.image_url,e.is_featured,e.translations_json,e.registration_deadline,actor) returning * into e;
 else
  update public.events v set title=e.title,category=e.category,organizer_name=e.organizer_name,university=e.university,university_id=e.university_id,specialty=e.specialty,format=e.format,city=e.city,location=e.location,online_url=e.online_url,start_date=e.start_date,end_date=e.end_date,description=e.description,program=e.program,speakers=e.speakers,target_audience=e.target_audience,price_type=e.price_type,price=e.price,registration_url=e.registration_url,contact_info=e.contact_info,image_url=e.image_url,is_featured=e.is_featured,translations_json=e.translations_json,registration_deadline=e.registration_deadline
  where v.id=event_id returning * into e;
 end if;
 return to_jsonb(e);
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then raise exception 'invalidInput';
end $$;

notify pgrst, 'reload schema';
commit;
