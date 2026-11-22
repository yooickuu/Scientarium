'use client';
import {useEffect,useState,FormEvent} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useLanguage} from '@/context/LanguageContext';
import Dialog from './Dialog';
import {api,ApiError,errorKey} from '@/lib/client';
import {usesSupabase,basePath} from '@/lib/paths';
export default function AuthModal(){
 const {isAuthModalOpen,closeAuthModal,authModalMode,refreshUser}=useAuth();const {t}=useLanguage();
 const [mode,setMode]=useState<'login'|'register'|'recover'>(authModalMode);const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');const [error,setError]=useState('');const [info,setInfo]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{setMode(authModalMode);setError('');setInfo('');setPassword('');},[isAuthModalOpen,authModalMode]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setInfo('');try{
  if(mode==='recover'){
   const {getSupabase}=await import('@/lib/supabase');
   const {error}=await getSupabase().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+basePath+'/auth/reset/'});
   if(error)throw new ApiError(error.status===429?'rateLimit':'requestError',error.status||500);
   setInfo('recoverySent');return;
  }
  const data=await api(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify({email,password,full_name:name})});
  if(data.confirmationRequired){setInfo('confirmEmail');setPassword('');return;}
  await refreshUser();closeAuthModal();
 }catch(err){setError(err instanceof ApiError&&err.status===409?'emailTaken':err instanceof ApiError&&err.status===401?'loginError':errorKey(err));}finally{setBusy(false);}}
 if(!isAuthModalOpen)return null;
 return <Dialog title={t(mode==='recover'?'forgotPassword':mode)} onClose={closeAuthModal}>
  <p className="muted text-sm">{t('authIntro')}</p>
  <div className="grid grid-cols-2 gap-2">{(['login','register'] as const).map(value=><button type="button" className={`pill ${mode===value?'active':''}`} key={value} onClick={()=>{setMode(value);setError('');setInfo('');}}>{t(value)}</button>)}</div>
  <form onSubmit={submit} className="space-y-4">
   {mode==='register'&&<label className="block"><span className="label">{t('fullName')}</span><input className="field" autoComplete="name" required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label>}
   <label className="block"><span className="label">{t('email')}</span><input className="field" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   {mode!=='recover'&&<label className="block"><span className="label">{t('password')}</span><input className="field" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?12:1} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='register'&&<span className="help">{t('passwordHint')}</span>}</label>}
   {error&&<p role="alert" className="notice error">{t(error)}</p>}{info&&<p role="status" className="notice">{t(info)}</p>}
   <button disabled={busy} className="button w-full">{t(busy?'loading':mode==='recover'?'sendRecovery':mode)}</button>
   {usesSupabase&&mode==='login'&&<button type="button" className="text-sm underline w-full py-2" onClick={()=>{setMode('recover');setError('');setInfo('');}}>{t('forgotPassword')}</button>}
  </form>
 </Dialog>;
}
