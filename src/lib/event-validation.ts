import db from './db';
import { MedicalEvent } from '@/types';
import { InputError } from './request-security';

const textFields = ['title', 'category', 'organizer_name', 'university', 'specialty', 'format', 'city', 'location', 'online_url', 'start_date', 'end_date', 'description', 'program', 'speakers', 'target_audience', 'price_type', 'price', 'registration_url', 'contact_info', 'image_url'];

export function parseEvent(body: Record<string, unknown>, existing?: MedicalEvent): Partial<MedicalEvent> {
  const clean: Record<string, string | boolean | null> = {};
  for (const field of textFields) {
    if (!(field in body)) continue;
    const value = body[field];
    const maxLength = field === 'image_url' ? 1_500_000 : ['description', 'program', 'speakers'].includes(field) ? 30_000 : 2000;
    if (typeof value !== 'string' || value.length > maxLength) throw new InputError(`Некорректное поле: ${field}`);
    clean[field] = value.trim();
  }
  if ('is_featured' in body) {
    if (typeof body.is_featured !== 'boolean') throw new InputError('Некорректное значение рекомендации');
    clean.is_featured = body.is_featured;
  }
  if ('university_id' in body) {
    const id = body.university_id;
    if (id !== null && (!Number.isSafeInteger(id) || Number(id) < 1)) throw new InputError('Некорректный вуз');
    if (id !== null) {
      const university = db.prepare('SELECT name FROM universities WHERE id = ? AND is_active = 1').get(id) as {name: string} | undefined;
      if (!university && id !== existing?.university_id) throw new InputError('Вуз не найден');
      if (university) clean.university = university.name;
    }
    (clean as Record<string, unknown>).university_id = id;
  }
  if ('translations_json' in body) {
    if (typeof body.translations_json !== 'string' || body.translations_json.length > 180000) throw new InputError('Некорректный перевод');
    try {
      const translations = JSON.parse(body.translations_json);
      if (!translations || typeof translations !== 'object' || Array.isArray(translations)) throw new Error();
      const result: Record<string, Record<string, string>> = {};
      for (const lang of ['ru', 'kk', 'en']) {
        if (!translations[lang]) continue;
        result[lang] = {};
        for (const field of ['title','description','program','speakers','target_audience','location','organizer_name','specialty']) {
          const value = translations[lang][field];
          if (value === undefined) continue;
          if (typeof value !== 'string' || value.length > 30000) throw new Error();
          result[lang][field] = value.trim();
        }
      }
      clean.translations_json = JSON.stringify(result);
    } catch { throw new InputError('Некорректный перевод'); }
  }
  if ('registration_deadline' in body) {
    const value=body.registration_deadline;
    if(value!==null&&value!==''&&(typeof value!=='string'||!Number.isFinite(Date.parse(value))))throw new InputError('deadlineError');
    clean.registration_deadline=value?new Date(value as string).toISOString():null;
  }
  const event = { ...existing, ...clean } as Partial<MedicalEvent>;
  for (const field of ['title', 'category', 'start_date', 'end_date', 'description', 'location'] as const) {
    if (!event[field]) throw new InputError('Заполните название, категорию, даты, описание и место проведения');
  }
  if (!['conference', 'training', 'masterclass', 'webinar', 'olympiad', 'snk', 'other'].includes(event.category!)) throw new InputError('Некорректная категория');
  if (event.format !== undefined && !['offline', 'online', 'hybrid'].includes(event.format)) throw new InputError('Некорректный формат');
  if (event.price_type !== undefined && !['free', 'paid'].includes(event.price_type)) throw new InputError('Некорректный тип оплаты');
  const start = Date.parse(event.start_date!);
  const end = Date.parse(event.end_date!);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new InputError('Проверьте даты начала и окончания');
  if(event.registration_deadline&&Date.parse(event.registration_deadline)>end)throw new InputError('deadlineError');
  for (const field of ['start_date', 'end_date']) {
    if (typeof clean[field] === 'string') clean[field] = new Date(clean[field]).toISOString();
  }
  for (const field of ['online_url', 'registration_url', 'image_url'] as const) {
    const value = event[field];
    if (!value) continue;
    if (field === 'image_url' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) continue;
    if (field === 'image_url' && /^\/(?!\/)[^\\\s]*$/.test(value)) continue;
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new InputError('Укажите корректную http/https-ссылку'); }
  }
  return clean as Partial<MedicalEvent>;
}
