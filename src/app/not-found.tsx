'use client';
import Link from 'next/link';
import Shell from '@/components/Shell';
import {useLanguage} from '@/context/LanguageContext';
export default function NotFound(){const {t}=useLanguage();return <Shell><div className="panel text-center py-16 space-y-5"><p className="text-5xl font-extrabold text-brand-500">404</p><h1 className="section-title">{t('noResults')}</h1><Link className="button" href="/">{t('backEvents')}</Link></div></Shell>;}
