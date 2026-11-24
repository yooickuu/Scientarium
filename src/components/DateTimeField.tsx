'use client';
import {useEffect,useId,useState} from 'react';
import {useLanguage} from '@/context/LanguageContext';
export default function DateTimeField({label,value,onChange,minDate,required=true}:{label:string;value:string;onChange:(value:string)=>void;minDate?:string;required?:boolean}){
 const {t}=useLanguage();const id=useId();const [day,setDay]=useState(value.split('T')[0]||'');const [time,setTime]=useState(value.split('T')[1]||'09:00');
 useEffect(()=>{if(value){setDay(value.split('T')[0]);setTime(value.split('T')[1]||'09:00');}},[value]);
 function change(date:string,hour:string){setDay(date);setTime(hour);onChange(date&&hour?`${date}T${hour}`:'');}
 return <fieldset className="date-time-group"><legend>{label}{required?' *':''}</legend><div className="date-time-fields"><label htmlFor={id+'-date'}><span className="label">{t('eventDay')}</span><input id={id+'-date'} className="field" type="date" required={required} min={minDate} value={day} onChange={e=>change(e.target.value,time)}/></label><label htmlFor={id+'-time'}><span className="label">{t('eventTime')}</span><input id={id+'-time'} className="field" type="time" required={required||Boolean(day)} step={60} value={time} onChange={e=>change(day,e.target.value)}/></label></div></fieldset>;
}
