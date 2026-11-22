'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, GraduationCap, Globe, Check, Eye } from 'lucide-react';
import { University } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { universityName } from '@/lib/i18n/messages';
import { api, errorKey } from '@/lib/client';
import Dialog from '../Dialog';

const empty = {
  name: '',
  name_kk: '',
  name_en: '',
  country: '',
  city: '',
  website: '',
  description: '',
  relationship: 'partner' as University['relationship'],
  is_active: true,
};

export default function UniversitiesPanel() {
  const { t, locale } = useLanguage();
  const [universities, setUniversities] = useState<University[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [remove, setRemove] = useState<University | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    try {
      const data = await api('/api/universities?manage=1');
      setUniversities(data.universities || []);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (show) {
      formRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [show, editId]);

  function open(u?: University) {
    setForm(u ? { ...u, is_active: Boolean(u.is_active), relationship: u.relationship || 'partner' } : empty);
    setEditId(u?.id || null);
    setShow(true);
    setError('');
    setSuccess(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      await api('/api/universities' + (editId ? '/' + editId : ''), {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      await load();
      setShow(false);
      setSuccess(true);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteUniversity() {
    if (!remove) return;
    setBusy(true);
    try {
      await api('/api/universities/' + remove.id, { method: 'DELETE' });
      await load();
      setRemove(null);
      if (editId === remove.id) setShow(false);
    } catch (e) {
      setError(errorKey(e));
      setRemove(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <span>{t('universities')}</span>
            <span className="badge text-xs">{universities.length}</span>
          </h2>
          <p className="muted text-xs mt-1">
            Вузы автоматически отображаются в самом низу сайта для всех посетителей
          </p>
        </div>
        <button className="button" onClick={() => open()}>
          <Plus size={18} />
          {t('addUniversity')}
        </button>
      </div>

      {error && (
        <p className="notice error enter" role="alert">
          {t(error)}
        </p>
      )}
      {success && (
        <p className="notice enter" role="status">
          {t('savedChanges')}
        </p>
      )}

      {show && (
        <form ref={formRef} onSubmit={submit} className="panel space-y-4 scroll-mt-24 enter border-brand-500/30">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h3 className="section-title text-base sm:text-lg">
              {t(editId ? 'editUniversity' : 'addUniversity')}
            </h3>
            <span className="text-xs muted">
              {editId ? 'ID #' + editId : 'Новая запись'}
            </span>
          </div>

          <div className="form-grid">
            {(['name', 'name_kk', 'name_en', 'country', 'city', 'website'] as const).map((key) => (
              <label key={key} className={key === 'name' ? 'sm:col-span-2' : ''}>
                <span className="label">
                  {key === 'name'
                    ? t('universityName') + ' *'
                    : key === 'name_kk'
                    ? t('universityName') + ' · Қазақша'
                    : key === 'name_en'
                    ? t('universityName') + ' · English'
                    : t(key)}
                </span>
                <input
                  className="field"
                  type={key === 'website' ? 'url' : 'text'}
                  required={key === 'name'}
                  maxLength={300}
                  placeholder={
                    key === 'name'
                      ? 'Карагандинский медицинский университет'
                      : key === 'website'
                      ? 'https://kmu.edu.kz'
                      : key === 'city'
                      ? 'Караганда'
                      : key === 'country'
                      ? 'Казахстан'
                      : ''
                  }
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}

            <label className="flex gap-3 items-center min-h-12 p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                className="w-5 h-5 accent-purple-700 rounded-md cursor-pointer"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <div>
                <span className="font-semibold text-sm block text-[var(--ink)]">
                  {t('visible')}
                </span>
                <span className="text-xs muted block">
                  Если включено, вуз показывается в нижнем блоке сайта и в фильтрах мероприятий
                </span>
              </div>
            </label>

            <label className="span-full">
              <span className="label">{t('description')}</span>
              <textarea
                className="field"
                rows={3}
                maxLength={3000}
                placeholder="Краткая информация о факультетах, кафедрах или СНО..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--line)]">
            <button type="button" className="button secondary" disabled={busy} onClick={() => setShow(false)}>
              {t('cancel')}
            </button>
            <button className="button" disabled={busy}>
              {t(busy ? 'saving' : 'save')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted py-8 text-center">{t('loading')}</p>
      ) : universities.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {universities.map((u) => (
            <article
              className="panel flex flex-col justify-between space-y-4 hover:border-brand-500/40 transition-all duration-200"
              key={u.id}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                    <GraduationCap size={22} />
                  </div>
                  {!u.is_active && (
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs">
                      {t('hidden')}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base leading-snug text-[var(--ink)]">
                  {universityName(u, locale)}
                </h3>

                <p className="muted text-xs">
                  {[u.city, u.country].filter(Boolean).join(' · ') || 'Город не указан'}
                </p>

                {u.website && (
                  <a
                    href={u.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline truncate max-w-full"
                  >
                    <Globe size={13} />
                    <span className="truncate">{u.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-[var(--line)]">
                <button className="button secondary flex-1 !min-h-[38px] !py-1.5 !text-xs" onClick={() => open(u)}>
                  <Pencil size={14} />
                  {t('edit')}
                </button>
                <button
                  className="icon-button !w-[38px] !h-[38px] !text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  aria-label={`${t('delete')}: ${u.name}`}
                  onClick={() => setRemove(u)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel text-center py-12 muted space-y-3">
          <GraduationCap size={36} className="mx-auto text-brand-500 opacity-60" />
          <p className="font-medium">{t('noUniversities')}</p>
        </div>
      )}

      {remove && (
        <Dialog title={t('confirmDelete')} onClose={() => { if (!busy) setRemove(null); }}>
          <div className="space-y-4">
            <p className="font-bold text-[var(--ink)]">{universityName(remove, locale)}</p>
            <p className="muted text-sm">{t('universityDeleteText')}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="button secondary" disabled={busy} onClick={() => setRemove(null)}>
                {t('cancel')}
              </button>
              <button className="button danger" disabled={busy} onClick={deleteUniversity}>
                {t(busy ? 'loading' : 'delete')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
