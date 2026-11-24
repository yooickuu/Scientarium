'use client';
import {Clock3} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
export default function RegistrationDeadline({value}:{value?:string|null}){
 const {t,date}=useLanguage();if(!value||!Number.isFinite(Date.parse(value)))return null;
 return <p className="registration-deadline"><Clock3 size={17} aria-hidden="true"/><span><span className="font-semibold">{t('registrationDeadline')}: </span><time dateTime={value}>{date(value,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</time></span></p>;
}
