// Next Link adds basePath itself; plain assets and browser redirects do not.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const usesSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === 'supabase';
export const assetPath = (path: string) => basePath + path;
export const eventPath = (id: number) => usesSupabase ? `/events/?id=${id}` : `/events/${id}`;
export const editEventPath = (id: number) => usesSupabase ? `/admin/events/edit/?id=${id}` : `/admin/events/${id}/edit`;
