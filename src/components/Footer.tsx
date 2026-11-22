'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { University } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { universityName } from '@/lib/i18n/messages';
import { api } from '@/lib/client';

export default function Footer() {
  const { t, locale } = useLanguage();
  const [universities, setUniversities] = useState<University[]>([]);

  useEffect(() => {
    api('/api/universities')
      .then((data) => setUniversities(data.universities || []))
      .catch(() => {});
  }, []);

  return (
    <footer className="site-footer">
      <div className="max-w-[1080px] mx-auto space-y-4">
        {universities.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pb-4 border-b border-[var(--line)]">
            {universities.map((u) => {
              const name = universityName(u, locale);
              return u.website ? (
                <a
                  key={u.id}
                  href={u.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium text-[var(--muted)] hover:text-brand-600 dark:hover:text-brand-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>{name}</span>
                  <ExternalLink size={12} className="opacity-60" />
                </a>
              ) : (
                <span
                  key={u.id}
                  className="text-xs sm:text-sm font-medium text-[var(--muted)]"
                >
                  {name}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm text-[var(--muted)]">
          <p>{t('footerText')}</p>
          <p className="font-medium text-[11px] sm:text-xs">
            © {new Date().getFullYear()} Scientarium
          </p>
        </div>
      </div>
    </footer>
  );
}
