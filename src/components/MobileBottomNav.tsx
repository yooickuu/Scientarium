'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Compass,CalendarDays,Bookmark,UserRound} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
export default function MobileBottomNav(){const path=usePathname();const {t}=useLanguage();return <nav className="mobile-nav" aria-label={t('siteTitle')}>{[{href:'/',key:'events',Icon:Compass},{href:'/calendar',key:'calendar',Icon:CalendarDays},{href:'/bookmarks',key:'saved',Icon:Bookmark},{href:'/profile',key:'profile',Icon:UserRound}].map(({href,key,Icon})=><Link key={href} href={href} aria-current={(href==='/'?(path==='/'||(path==='/events'||path.startsWith('/events/'))):path===href)?'page':undefined}><Icon/><span>{t(key)}</span></Link>)}</nav>;}
