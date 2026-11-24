import { getSupabase } from './supabase';
import { ApiError } from './api-error';
import { basePath } from './paths';
import type { MedicalEvent, User } from '@/types';

function fail(error: { message: string; code?: string; status?: number }) {
  const known = ['deadlineError','nicknameCooldown','nicknameTaken','nicknameRules','imageError','invalidInput','forbidden','loginRequired','notFound','ownerProtected','alreadyExists'];
  const code = known.find(value => error.message.includes(value));
  if (code) throw new ApiError(code, code === 'loginRequired' ? 401 : code === 'forbidden' || code === 'ownerProtected' ? 403 : code === 'notFound' ? 404 : 400);
  if (error.code === 'PGRST202') throw new ApiError('serviceUnavailable',503);
  if (error.code === '23505') throw new ApiError('alreadyExists', 409);
  if (error.code === '42501') throw new ApiError('forbidden', 403);
  if (error.code === 'invalid_credentials') throw new ApiError('loginError', 401);
  if (error.code === 'email_not_confirmed') throw new ApiError('confirmEmail', 400);
  if (error.status === 429) throw new ApiError('rateLimit', 429);
  throw new ApiError('requestError', error.status || 500);
}
async function rpc(name: string, args: Record<string, unknown> = {}, signal?: AbortSignal | null) {
  let query = getSupabase().rpc(name, args);
  if (signal) query = query.abortSignal(signal);
  const {data, error} = await query;
  if (error) fail(error);
  return data;
}
async function me(): Promise<User | null> {
  const {data, error} = await getSupabase().auth.getSession();
  if (error) fail(error);
  if (!data.session) return null;
  return rpc('get_my_profile');
}
async function requireUser() {
  const user = await me();
  if (!user) throw new ApiError('loginRequired', 401);
  return user;
}
const eventFields = 'id,title,slug,category,organizer_name,university,university_id,specialty,format,city,location,online_url,start_date,end_date,description,program,speakers,target_audience,price_type,price,registration_url,registration_deadline,contact_info,image_url,is_featured,created_by,views_count,created_at,translations_json';

export async function supabaseApi(input: string, options: RequestInit = {}): Promise<any> {
  options.signal?.throwIfAborted();
  const url = new URL(input, 'https://scientarium.invalid');
  const path = url.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  const sb = getSupabase();
  if (path === '/api/auth/me') return {user: await me()};
  if (path === '/api/auth/logout') {
    const {error} = await sb.auth.signOut(); if (error) fail(error);
    return {ok: true};
  }
  if (path === '/api/auth/login') {
    const {error} = await sb.auth.signInWithPassword({email: body.email.trim(), password: body.password});
    if (error) fail(error);
    return {user: await me()};
  }
  if (path === '/api/auth/register') {
    if (body.password?.length < 12 || !body.full_name?.trim()) throw new ApiError('invalidInput', 400);
    const {data, error} = await sb.auth.signUp({email: body.email.trim(), password: body.password,
      options: {data: {full_name: body.full_name.trim()}, emailRedirectTo: window.location.origin + basePath + '/auth/confirm/'}});
    if (error) fail(error);
    return {confirmationRequired: !data.session};
  }
  if (path === '/api/profile') return {user: await rpc('update_profile', {payload: body})};
  if (path === '/api/admin/users') return method === 'GET'
    ? {users: await rpc('admin_users', {}, options.signal)}
    : await rpc('set_user_role', {target_email: body.email, new_role: body.role});
  if (path === '/api/admin/backup') return rpc(method === 'GET' ? 'backup_status' : 'download_backup', {}, options.signal);
  if (path === '/api/admin/backup/restore') return rpc('restore_deleted_record', {revision_id:body.revision_id});
  if (path === '/api/admin/stats') return {stats: await rpc('admin_stats', {period_days: Number(url.searchParams.get('days')) || 30}, options.signal)};
  if (path === '/api/analytics') return rpc('record_visit', {page_path: body.path, view_key: body.view_id, session_key: body.session_id, device_type: body.device});

  if (path.startsWith('/api/universities')) {
    const id = Number(path.split('/')[3]) || null;
    if (method !== 'GET') return {university: await rpc(method === 'DELETE' ? 'delete_university' : 'save_university',
      method === 'DELETE' ? {university_id: id} : {university_id: id, payload: body})};
    const user = url.searchParams.get('manage') === '1' ? await requireUser() : null;
    if (user && user.role !== 'admin') throw new ApiError('forbidden', 403);
    let query = sb.from('universities').select('*').order('name');
    if (!user) query = query.eq('is_active', true);
    if (options.signal) query = query.abortSignal(options.signal);
    const {data, error} = await query; if (error) fail(error);
    return {universities: data || []};
  }
  if (path === '/api/bookmarks' && method !== 'GET') {
    const user = await requireUser();
    const eventId = Number(method === 'DELETE' ? url.searchParams.get('event_id') : body.event_id);
    if (!Number.isSafeInteger(eventId) || eventId < 1) throw new ApiError('invalidInput', 400);
    const {error} = method === 'DELETE'
      ? await sb.from('bookmarks').delete().eq('user_id', user.id).eq('event_id', eventId)
      : await sb.from('bookmarks').upsert({user_id: user.id, event_id: eventId}, {onConflict: 'user_id,event_id', ignoreDuplicates: true});
    if (error) fail(error); return {bookmarked: method !== 'DELETE'};
  }
  if (path.startsWith('/api/events') || path === '/api/bookmarks') {
    const id = Number(path.split('/')[3]) || null;
    if (method === 'DELETE') return rpc('delete_event', {event_id: id});
    if (method !== 'GET') return {event: await rpc('save_event', {event_id: id, payload: body})};
    const user = await me();
    const manage = url.searchParams.get('manage') === '1';
    if (manage && (!user || user.role === 'user')) throw new ApiError('forbidden', 403);
    if (path === '/api/bookmarks' && !user) throw new ApiError('loginRequired', 401);
    let savedIds: number[] = [];
    if (user) {
      const {data, error} = await sb.from('bookmarks').select('event_id').eq('user_id', user.id);
      if (error) fail(error); savedIds = (data || []).map(row => row.event_id);
    }
    if (path === '/api/bookmarks' && !savedIds.length) return {events: []};
    let query = sb.from('events').select(eventFields).order('start_date').order('id');
    if (id) query = query.eq('id', id);
    if (path === '/api/bookmarks') query = query.in('id', savedIds);
    if (manage && user?.role === 'moderator') query = query.eq('created_by', user.id);
    for (const key of ['category','format','city','university','university_id']) {
      const value = url.searchParams.get(key);
      if (value && value !== 'all') query = query.eq(key, value);
    }
    if (url.searchParams.get('featured') === '1') query = query.eq('is_featured', true);
    const time = url.searchParams.get('timeFilter');
    if (time === 'upcoming') query = query.gte('end_date', new Date().toISOString());
    if (time === 'past') query = query.lt('end_date', new Date().toISOString());
    const search = url.searchParams.get('search')?.trim().slice(0,200);
    // Quoted PostgREST values prevent search text from becoming filter syntax.
    if (search) {
      const value = JSON.stringify('%' + search.replace(/[%_\\]/g, '\\$&') + '%');
      query = query.or(['title','description','speakers','organizer_name','translations_json'].map(key => `${key}.ilike.${value}`).join(','));
    }
    if (options.signal) query = query.abortSignal(options.signal);
    const {data, error} = await query.limit(1000); if (error) fail(error);
    const events = ((data || []) as unknown as MedicalEvent[]).map(event => ({...event, is_bookmarked: savedIds.includes(event.id)}));
    if (id && !events[0]) throw new ApiError('notFound', 404);
    if (manage) {
      const authors: {id:number;full_name:string}[] = await rpc('event_authors');
      for (const event of events) Object.assign(event, {author_name: authors.find(author => author.id === event.created_by)?.full_name || ''});
    }
    return id ? {event: events[0]} : {events};
  }
  throw new ApiError('notFound', 404);
}
