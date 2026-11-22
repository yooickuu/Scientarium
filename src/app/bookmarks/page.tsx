'use client';
import {useEffect,useState} from 'react';
import {Bookmark} from 'lucide-react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import EventCard from '@/components/EventCard';
import {MedicalEvent} from '@/types';
import {useAuth} from '@/context/AuthContext';
import {useLanguage} from '@/context/LanguageContext';
import {api,errorKey} from '@/lib/client';
export default function Bookmarks(){const {user,loading:authLoading,openAuthModal}=useAuth();const {t}=useLanguage();const [events,setEvents]=useState<MedicalEvent[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);useEffect(()=>{if(authLoading)return;if(!user){setEvents([]);setLoading(false);return;}let active=true;setLoading(true);setError('');api('/api/bookmarks').then(data=>{if(active)setEvents(data.events);}).catch(err=>{if(active)setError(errorKey(err));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[user?.id,authLoading,retry]);return <Shell><h1 className="page-title mb-7">{t('saved')}</h1>{authLoading||loading?<p className="muted">{t('loading')}</p>:!user?<div className="panel text-center py-12 space-y-4"><Bookmark size={36} className="mx-auto muted"/><p>{t('loginRequired')}</p><button className="button" onClick={()=>openAuthModal()}>{t('login')}</button></div>:error?<div className="notice error">{t(error)} <button className="underline" onClick={()=>setRetry(retry+1)}>{t('retry')}</button></div>:events.length?<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{events.map(event=><EventCard key={event.id} event={event} onBookmarkChange={(id,saved)=>{if(!saved)setEvents(list=>list.filter(e=>e.id!==id));}}/>)}</div>:<div className="panel text-center py-12 space-y-4"><Bookmark size={36} className="mx-auto muted"/><h2 className="section-title">{t('noSaved')}</h2><p className="muted text-sm">{t('noSavedText')}</p><Link className="button" href="/">{t('explore')}</Link></div>}</Shell>;}
