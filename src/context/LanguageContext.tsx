'use client';
import {createContext,useContext,useState,useCallback,useEffect,ReactNode} from 'react';
import {Locale} from '@/types';
import {translate,localeTags} from '@/lib/i18n/messages';
const Context=createContext<{locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string)=>string;date:(value:string|number,options?:Intl.DateTimeFormatOptions)=>string}|null>(null);
export function LanguageProvider({children,initialLocale='ru'}:{children:ReactNode;initialLocale?:Locale}){
  const [locale,setValue]=useState<Locale>(initialLocale);
  const t=useCallback((key:string)=>translate(locale,key),[locale]);
  const date=useCallback((value:string|number,options:Intl.DateTimeFormatOptions={day:'numeric',month:'long',year:'numeric'})=>new Intl.DateTimeFormat(localeTags[locale],options).format(new Date(value)),[locale]);
  const setLocale=(value:Locale)=>{setValue(value);document.documentElement.lang=value;document.cookie=`scientarium_locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;};
  useEffect(()=>{const value=document.cookie.split('; ').find(item=>item.startsWith('scientarium_locale='))?.split('=')[1];if(value==='ru'||value==='kk'||value==='en')setValue(value);},[]);
  useEffect(()=>{document.documentElement.lang=locale;document.title=translate(locale,'siteTitle');},[locale]);
  return <Context.Provider value={{locale,setLocale,t,date}}>{children}</Context.Provider>;
}
export function useLanguage(){const ctx=useContext(Context);if(!ctx)throw new Error('LanguageProvider missing');return ctx;}
