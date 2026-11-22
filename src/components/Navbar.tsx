'use client';
import {assetPath} from '@/lib/paths';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { Locale } from '@/types';

export default function Navbar() {
  const { user, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname().replace(/\/$/,'') || '/';

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="flex items-center gap-2.5 mr-auto group" aria-label="Scientarium">
          <Image
            src={assetPath("/scientarium-icon.webp")}
            width={40}
            height={40}
            sizes="40px"
            priority
            className="rounded-xl transition-transform duration-200 group-hover:scale-105"
            alt="Scientarium Owl"
          />
          <span className="font-extrabold tracking-tight text-base sm:text-xl text-[var(--ink)] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            SCIENTARIUM
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 mr-4 text-sm font-semibold">
          <Link
            href="/"
            className={`py-1 transition-colors ${
              pathname === '/'
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t('events')}
          </Link>
          <Link
            href="/calendar"
            className={`py-1 transition-colors ${
              pathname === '/calendar'
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t('calendar')}
          </Link>
          <Link
            href="/bookmarks"
            className={`py-1 transition-colors ${
              pathname === '/bookmarks'
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t('saved')}
          </Link>
        </nav>

        <select
          aria-label={t('language')}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="field !w-[74px] !min-h-[44px] !h-[44px] !py-2 !px-2.5 !text-xs font-bold !rounded-[14px] cursor-pointer hover:border-[#9562ca60] transition-colors"
        >
          <option value="ru">RU</option>
          <option value="kk">ҚАЗ</option>
          <option value="en">EN</option>
        </select>

        <button
          className="icon-button !w-[44px] !h-[44px] !min-h-[44px] !rounded-[14px]"
          aria-label={t('theme')}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
          ) : (
            <Moon size={18} className="text-slate-700 transition-transform duration-300 hover:-rotate-12" />
          )}
        </button>

        {user && user.role !== 'user' && (
          <Link
            className="icon-button !w-[44px] !h-[44px] !min-h-[44px] !rounded-[14px] text-brand-600 dark:text-brand-400"
            href="/admin"
            aria-label={t('management')}
          >
            <LayoutDashboard size={18} />
          </Link>
        )}

        <div className="hidden md:block">
          {user ? (
            <Link href="/profile" className="button secondary !min-h-[44px] !py-2 !px-4 !text-xs sm:!text-sm !rounded-[14px]">
              {user.nickname || t('profile')}
            </Link>
          ) : (
            <button
              className="button !min-h-[44px] !py-2 !px-4 !text-xs sm:!text-sm !rounded-[14px]"
              onClick={() => openAuthModal('login')}
            >
              {t('login')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
