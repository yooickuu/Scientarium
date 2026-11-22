'use client';
import {useEffect,useRef,ReactNode} from 'react';
import {X} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
export default function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);const {t}=useLanguage();const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow=overflow;};},[]);
  return <dialog ref={ref} className="dialog" aria-label={title} onCancel={e=>{e.preventDefault();onCloseRef.current();}} onClick={e=>{if(e.target===e.currentTarget)onCloseRef.current();}}><div className="panel space-y-5"><div className="flex items-center justify-between gap-3"><h2 className="section-title">{title}</h2><button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}><X size={20}/></button></div>{children}</div></dialog>;
}
