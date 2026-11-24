export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  university?: string;
  specialty?: string;
  created_at: string;
  nickname?: string | null;
  nickname_changed_at?: string | null;
  avatar_url?: string;
  account_category?: string;
  is_owner?: boolean;
}

export type EventCategory = 
  | 'conference' 
  | 'training' 
  | 'masterclass' 
  | 'webinar' 
  | 'olympiad' 
  | 'snk' 
  | 'other';

export type EventFormat = 'offline' | 'online' | 'hybrid';

export interface MedicalEvent {
  id: number;
  title: string;
  slug: string;
  category: EventCategory;
  organizer_name: string;
  university: string;
  university_id?: number | null;
  specialty: string;
  format: EventFormat;
  city: string;
  location: string;
  online_url?: string;
  start_date: string; // ISO 8601 string
  end_date: string;
  description: string;
  program?: string;
  speakers?: string;
  target_audience?: string;
  price_type: 'free' | 'paid';
  price?: string;
  registration_url?: string;
  registration_deadline?: string | null;
  contact_info?: string;
  image_url?: string;
  is_featured: boolean;
  created_by?: number;
  views_count: number;
  created_at: string;
  is_bookmarked?: boolean;
  translations_json?: string;
  author_name?: string;
}

export interface AuthSession {
  user: User | null;
  token?: string;
}

export interface University {
  id: number;
  name: string;
  name_kk: string;
  name_en: string;
  country: string;
  city: string;
  website: string;
  description: string;
  relationship: 'partner' | 'participant';
  is_active: boolean;
}
export type Locale = 'ru' | 'kk' | 'en';
