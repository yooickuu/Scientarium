'use client';
import {assetPath} from '@/lib/paths';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, SlidersHorizontal, CalendarDays, Plus } from 'lucide-react';
import Shell from './Shell';
import EventCard from './EventCard';
import CalendarView from './CalendarView';
import { MedicalEvent, University } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { universityName } from '@/lib/i18n/messages';
import { api, errorKey } from '@/lib/client';

const categories = ['all', 'conference', 'training', 'masterclass', 'webinar', 'olympiad', 'snk', 'other'];

export default function EventCatalog({ calendar = false }: { calendar?: boolean }) {
  const { t, locale, date } = useLanguage();
  const { user } = useAuth();
  const [events, setEvents] = useState<MedicalEvent[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [format, setFormat] = useState('all');
  const [university, setUniversity] = useState('all');
  const [time, setTime] = useState(calendar ? 'all' : 'upcoming');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    api('/api/universities').then((data) => setUniversities(data.universities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ search, category, format, timeFilter: time });
      if (university !== 'all') query.set('university_id', university);
      api('/api/events?' + query, { signal: controller.signal })
        .then((data) => setEvents(data.events || []))
        .catch((err) => {
          if (!controller.signal.aborted) setError(errorKey(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, category, format, university, time, retry, user?.id]);

  const shown = selectedDate
    ? events.filter((event) => {
        const d = new Date(event.start_date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === selectedDate;
      })
    : events;

  const filtered = Boolean(search || category !== 'all' || format !== 'all' || university !== 'all' || selectedDate || time === 'past');

  const reset = () => {
    setSearch('');
    setCategory('all');
    setFormat('all');
    setUniversity('all');
    setTime('all');
    setSelectedDate(null);
  };

  return (
    <Shell>
      <div className="space-y-6">
        {!calendar ? (
          <section className="hero relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Mobile watermark logo */}
            <div className="md:hidden absolute -right-6 -bottom-6 w-60 h-60 opacity-15 pointer-events-none select-none">
              <Image
                src={assetPath("/scientarium-owl.webp")}
                width={240}
                height={240}
                alt=""
                priority
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-[580px] w-full">
                <p className="text-xs uppercase tracking-[.15em] font-semibold mb-4 text-purple-200">
                  {t('community')}
                </p>
                <h1>{t('heroTitle')}</h1>
                <p className="mt-5 text-sm sm:text-base text-purple-100/90 leading-relaxed">
                  {t('heroText')}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="button !bg-white !text-[#49206f] hover:!bg-purple-50 shadow-lg shadow-purple-950/30" href="#catalog">
                    {t('explore')}
                  </a>
                  {user && user.role !== 'user' && (
                    <Link href="/admin/events/new" className="button !bg-white/10 hover:!bg-white/20 !border-white/25 backdrop-blur-xs">
                      <Plus size={18} />
                      {t('addEvent')}
                    </Link>
                  )}
                </div>
              </div>

              {/* Desktop Owl Showcase with glowing gradient aura */}
              <div className="hidden md:flex flex-col items-center justify-center shrink-0 relative pr-4 lg:pr-8">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-400/25 via-indigo-400/30 to-violet-300/20 rounded-full blur-2xl transform scale-110 pointer-events-none" />
                <div className="relative w-52 h-52 lg:w-64 lg:h-64 flex items-center justify-center">
                  <Image
                    src={assetPath("/scientarium-owl.webp")}
                    width={256}
                    height={256}
                    alt="Scientarium Owl"
                    priority
                    className="w-full h-full object-contain filter drop-shadow-[0_20px_35px_rgba(15,7,30,0.55)] transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div>
            <p className="badge mb-3">SCIENTARIUM</p>
            <h1 className="page-title">{t('calendar')}</h1>
            <p className="muted mt-3">{t('chooseDate')}</p>
          </div>
        )}

        <section id="catalog" className="space-y-4 scroll-mt-24">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">{t('search')}</span>
              <Search size={19} className="absolute left-4 top-3.5 muted" />
              <input
                className="field !pl-11"
                type="search"
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className={`icon-button !h-[44px] !w-[44px] ${filters ? '!border-brand-400' : ''}`}
              aria-label={t('filters')}
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={19} />
            </button>
          </div>

          <div className="scroll-row">
            {categories.map((key) => (
              <button
                key={key}
                className={`pill ${category === key ? 'active' : ''}`}
                onClick={() => setCategory(key)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {filters && (
            <div className="panel form-grid enter">
              <label>
                <span className="label">{t('format')}</span>
                <select className="field" value={format} onChange={(e) => setFormat(e.target.value)}>
                  {['all', 'offline', 'online', 'hybrid'].map((key) => (
                    <option key={key} value={key}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label">{t('university')}</span>
                <select className="field" value={university} onChange={(e) => setUniversity(e.target.value)}>
                  <option value="all">{t('all')}</option>
                  {universities.map((u) => (
                    <option value={u.id} key={u.id}>
                      {universityName(u, locale)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label">{t('events')}</span>
                <select className="field" value={time} onChange={(e) => setTime(e.target.value)}>
                  {['upcoming', 'all', 'past'].map((key) => (
                    <option value={key} key={key}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>

              <button className="button secondary self-end" onClick={reset}>
                {t('reset')}
              </button>
            </div>
          )}
        </section>

        <div className={calendar ? 'grid lg:grid-cols-[360px_1fr] gap-6 items-start' : ''}>
          {calendar && (
            <CalendarView events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">
                {selectedDate ? date(selectedDate + 'T12:00:00') : t(time === 'upcoming' ? 'upcoming' : 'events')}
              </h2>
              {!loading && <span className="badge">{shown.length}</span>}
            </div>

            {error ? (
              <div className="notice error" role="alert">
                {t(error)}{' '}
                <button className="underline" onClick={() => setRetry(retry + 1)}>
                  {t('retry')}
                </button>
              </div>
            ) : loading ? (
              <div className="grid sm:grid-cols-2 gap-4" aria-label={t('loading')}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="panel h-72 animate-pulse" style={{ background: 'var(--surface-soft)' }} />
                ))}
              </div>
            ) : shown.length ? (
              <div className={`grid gap-4 sm:grid-cols-2 ${calendar ? '' : 'lg:grid-cols-3'}`}>
                {shown.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="panel text-center py-12 space-y-3">
                <CalendarDays className="mx-auto muted" size={36} />
                <h3 className="section-title">{t(filtered ? 'noResults' : 'noEvents')}</h3>
                <p className="muted text-sm">{t(filtered ? 'noResultsText' : 'noEventsText')}</p>
                {filtered && (
                  <button className="button secondary" onClick={reset}>
                    {t('reset')}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
