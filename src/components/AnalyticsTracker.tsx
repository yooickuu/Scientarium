'use client';
import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/client';
import {usesSupabase} from '@/lib/paths';
let volatileSession={id:'',expires:0};
export default function AnalyticsTracker(){
 const pathname=usePathname();const params=useSearchParams();const eventId=params.get('id');const {user,loading}=useAuth();
 useEffect(()=>{
  let path=pathname.replace(/\/$/,'')||'/';
  if(usesSupabase&&path==='/events'&&/^[1-9]\d*$/.test(eventId||''))path='/events/'+eventId;
  if(loading||(user&&user.role!=='user')||!/^\/(?:calendar|bookmarks|profile|events\/[1-9]\d*)?$/.test(path))return;
  const bucket=String(Math.floor(Date.now()/30000));const key=`scientarium.view:${path}:${bucket}`;
  let id='';let session=volatileSession;
  try{id=sessionStorage.getItem(key)||'';session=JSON.parse(sessionStorage.getItem('scientarium.visit')||'null')||session;}catch{}
  if(!id)id=crypto.randomUUID();
  if(!session.id||session.expires<Date.now())session={id:crypto.randomUUID(),expires:0};
  session.expires=Date.now()+1800000;volatileSession=session;
  try{
   sessionStorage.setItem(key,id);sessionStorage.setItem('scientarium.visit',JSON.stringify(session));
   for(let i=sessionStorage.length-1;i>=0;i--){const old=sessionStorage.key(i);if(old?.startsWith('scientarium.view:')&&!old.endsWith(bucket))sessionStorage.removeItem(old);}
  }catch{}
  void api('/api/analytics',{method:'POST',body:JSON.stringify({path,view_id:id,session_id:session.id,device:window.matchMedia('(max-width: 767px)').matches?'mobile':'desktop'})}).catch(()=>{});
 },[pathname,eventId,loading,user?.role]);
 return null;
}
