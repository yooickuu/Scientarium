'use client';
import {useLanguage} from '@/context/LanguageContext';
import Shell from '@/components/Shell';
import Link from 'next/link';
export default function PageError({reset}:{error:Error;reset:()=>void}) {
  const {t}=useLanguage();
  return <Shell><section className="panel max-w-lg mx-auto space-y-4" role="alert"><h1 className="section-title">{t('requestError')}</h1><p className="muted">{t('pageErrorHint')}</p><div className="flex gap-3"><button className="button" onClick={reset}>{t('retry')}</button><Link className="button secondary" href="/">{t('backEvents')}</Link></div></section></Shell>;
}
