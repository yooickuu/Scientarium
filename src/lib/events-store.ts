import db from './db';
import { MedicalEvent, User } from '@/types';
export const EVENT_FIELDS = ['title','category','organizer_name','university','specialty','format','city','location','online_url','start_date','end_date','description','program','speakers','target_audience','price_type','price','registration_url','contact_info','image_url','is_featured','university_id','translations_json'] as const;
export function canEditEvent(user: User | null, event: MedicalEvent) {
  return Boolean(user && (user.role === 'admin' || (user.role === 'moderator' && event.created_by === user.id)));
}
export function eventById(id: number, userId = -1): MedicalEvent | undefined {
  const row = db.prepare(`SELECT e.*, u.full_name AS author_name,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.event_id=e.id AND b.user_id=?) AS is_bookmarked
    FROM events e LEFT JOIN users u ON e.created_by=u.id WHERE e.id=?`).get(userId, id) as MedicalEvent | undefined;
  return row ? { ...row, is_featured: Boolean(row.is_featured), is_bookmarked: Boolean(row.is_bookmarked) } : undefined;
}
