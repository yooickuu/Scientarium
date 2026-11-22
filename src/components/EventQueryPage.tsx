'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {MedicalEvent} from '@/types';
import {api,errorKey} from '@/lib/client';
import {useLanguage} from '@/context/LanguageContext';
import {localizeEvent} from '@/lib/i18n/messages';
import EventDetails from './EventDetails';
import EventEditor from './EventEditor';
import Shell from './Shell';
import Link from 'next/link';
export default function EventQueryPage({edit=false}:{edit?:boolean}) {
  const params=useSearchParams();const id=Number(params.get('id'));const valid=Number.isSafeInteger(id)&&id>0;
  const [event,setEvent]=useState<MedicalEvent|null>(null);const [error,setError]=useState('');const {t,locale}=useLanguage();
  useEffect(()=>{
    if(edit||!valid)return;const ctrl=new AbortController();setEvent(null);setError('');
    api('/api/events/'+id,{signal:ctrl.signal}).then(data=>setEvent(data.event)).catch(e=>{if(!ctrl.signal.aborted)setError(errorKey(e));});
    return()=>ctrl.abort();
  },[id,valid,edit]);
  useEffect(()=>{if(event)document.title=localizeEvent(event,locale).title+' — Scientarium';},[event,locale]);
  if(!valid||error)return <Shell><div className="panel space-y-4"><p role="alert">{t(!valid?'notFound':error)}</p><Link className="button secondary" href="/">{t('backEvents')}</Link></div></Shell>;
  if(edit)return <EventEditor key={id} eventId={id}/>;
  return event?<EventDetails key={id} event={event}/>:<Shell><p className="muted">{t('loading')}</p></Shell>;
}
