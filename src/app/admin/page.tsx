'use client';
import {usesSupabase} from '@/lib/paths';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import {CalendarDays,Users,GraduationCap,ChartNoAxesCombined,ShieldCheck} from 'lucide-react';
import Shell from '@/components/Shell';
import {useLanguage} from '@/context/LanguageContext';
import {useAuth} from '@/context/AuthContext';
const Events=dynamic(()=>import('@/components/admin/EventsPanel'));
const UsersPanel=dynamic(()=>import('@/components/admin/UsersPanel'));
const Universities=dynamic(()=>import('@/components/admin/UniversitiesPanel'));
const Backups=dynamic(()=>import('@/components/admin/BackupPanel'));
const Analytics=dynamic(()=>import('@/components/admin/AnalyticsPanel'));
export default function Admin(){const {t}=useLanguage();const {user,loading,openAuthModal}=useAuth();const [tab,setTab]=useState('events');const staff=user&&user.role!=='user';const admin=user?.role==='admin';const active=admin?(tab==='backups'&&!user?.is_owner?'events':tab):'events';return <Shell><div className="space-y-6"><div><span className="badge mb-3"><ShieldCheck size={14}/>{t(admin?'admin':'moderator')}</span><h1 className="page-title">{t('dashboard')}</h1></div>{loading?<p className="muted">{t('loading')}</p>:!user?<div className="panel space-y-4"><p>{t('loginRequired')}</p><button className="button" onClick={()=>openAuthModal()}>{t('login')}</button></div>:!staff?<p className="notice error">{t('noAccess')}</p>:<>{admin&&<nav className="scroll-row" aria-label={t('management')}>{[{key:'events',Icon:CalendarDays},{key:'users',Icon:Users},{key:'universities',Icon:GraduationCap},{key:'analytics',Icon:ChartNoAxesCombined},...(user?.is_owner&&usesSupabase?[{key:'backups',Icon:ShieldCheck}]:[])].map(({key,Icon})=><button className={`pill flex items-center gap-2 ${active===key?'active':''}`} key={key} aria-pressed={active===key} onClick={()=>setTab(key)}><Icon size={18}/>{t(key)}</button>)}</nav>}<div key={active} className="enter">{active==='events'?<Events/>:active==='users'?<UsersPanel/>:active==='universities'?<Universities/>:active==='backups'?<Backups/>:<Analytics/>}</div></>}</div></Shell>;}
