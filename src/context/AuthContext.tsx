'use client';
import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {User} from '@/types';
import {api} from '@/lib/client';
import {usesSupabase} from '@/lib/paths';
interface AuthContextType {
 user: User | null; loading: boolean; refreshUser: () => Promise<void>; logout: () => Promise<void>;
 openAuthModal: (mode?: 'login' | 'register') => void; closeAuthModal: () => void;
 isAuthModalOpen: boolean; authModalMode: 'login' | 'register';
}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);
 const [isAuthModalOpen,setOpen]=useState(false);const [authModalMode,setMode]=useState<'login'|'register'>('login');
 const refreshUser=useCallback(async()=>{try{setUser((await api('/api/auth/me')).user||null);}catch{setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{
  void refreshUser();let alive=true;let unsubscribe:(()=>void)|undefined;
  if(usesSupabase)import('@/lib/supabase').then(({getSupabase})=>{
   if(!alive)return;
   const {data}=getSupabase().auth.onAuthStateChange(()=>{
    // Defer Auth calls until the SDK releases its auth-state lock.
    setTimeout(()=>{if(alive)void refreshUser();},0);
   });
   unsubscribe=()=>data.subscription.unsubscribe();
  }).catch(()=>setLoading(false));
  const focus=()=>void refreshUser();window.addEventListener('focus',focus);
  return()=>{alive=false;unsubscribe?.();window.removeEventListener('focus',focus);};
 },[refreshUser]);
 const logout=async()=>{await api('/api/auth/logout',{method:'POST'});setUser(null);};
 return <AuthContext.Provider value={{user,loading,refreshUser,logout,isAuthModalOpen,authModalMode,openAuthModal:(mode='login')=>{setMode(mode);setOpen(true);},closeAuthModal:()=>setOpen(false)}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;}
