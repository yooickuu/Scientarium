import React from 'react';
import { usesSupabase, assetPath } from '@/lib/paths';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { LanguageProvider } from '@/context/LanguageContext';
import { Locale } from '@/types';
import { translate } from '@/lib/i18n/messages';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthModal from '@/components/AuthModal';

export async function generateMetadata(): Promise<Metadata> {
  const value = usesSupabase ? 'ru' : (await cookies()).get('scientarium_locale')?.value;
  const locale: Locale = value === 'kk' || value === 'en' ? value : 'ru';
  return { title: translate(locale, 'siteTitle'), description: translate(locale, 'heroText'),
    icons: { icon: assetPath('/scientarium-icon.webp'), apple: assetPath('/scientarium-icon.webp') } };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const preferred = usesSupabase ? 'ru' : (await cookies()).get('scientarium_locale')?.value;
  const locale: Locale = preferred === 'kk' || preferred === 'en' ? preferred : 'ru';
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-[#f8f9fd] dark:bg-[#0f111a] text-[#171a29] dark:text-[#f1f3fa] antialiased selection:bg-brand-600 selection:text-white">
        <ThemeProvider>
          <LanguageProvider initialLocale={locale}>
          <AuthProvider>
            {children}
            <AuthModal />
            <Suspense fallback={null}><AnalyticsTracker /></Suspense>
          </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
