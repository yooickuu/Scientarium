'use client';
import {useEffect,useState,FormEvent} from 'react';
import Link from 'next/link';
import Shell from './Shell';
import {useAuth} from '@/context/AuthContext';
import {useLanguage} from '@/context/LanguageContext';
import {usesSupabase} from '@/lib/paths';
export default function AuthCallback({reset=false}:{reset?:boolean}){
 const {user,loading,openAuthModal,refreshUser}=useAuth();const {t}=useLanguage();const [password,setPassword]=useState('');const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [busy,setBusy]=useState(false);
 useEffect(()=>{const error=new URLSearchParams(window.location.hash.slice(1)).get('error');if(error)setError('authLinkExpired');},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const {getSupabase}=await import('@/lib/supabase');const {error}=await getSupabase().auth.updateUser({password});
  if(error){setError(error.status===429?'rateLimit':'requestError');return;}
  setPassword('');setSaved(true);await refreshUser();
 }catch{setError('requestError');}finally{setBusy(false);}}
 return <Shell><section className="panel max-w-lg mx-auto space-y-5"><h1 className="section-title">{t(reset?'newPassword':'emailConfirmation')}</h1>
 {error&&<p className="notice error" role="alert">{t(error)}</p>}
 {loading?<p>{t('loading')}</p>:!user?<><p className="muted">{t('authLinkExpired')}</p><button className="button" onClick={()=>openAuthModal()}>{t('login')}</button></>:reset&&!saved&&usesSupabase?
 <form onSubmit={submit} className="space-y-4"><label className="block"><span className="label">{t('newPassword')}</span><input className="field" autoComplete="new-password" type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/><span className="help">{t('passwordHint')}</span></label><button className="button" disabled={busy}>{t(busy?'saving':'save')}</button></form>:
 <><p className="notice">{t(reset?'savedChanges':'emailConfirmed')}</p><Link className="button" href="/profile">{t('profile')}</Link></>}
 </section></Shell>;
}
