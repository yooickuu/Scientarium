'use client';
import {useEffect,useState} from 'react';
import {Download,RotateCcw} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
import {api,errorKey} from '@/lib/client';
type Status={last_backup_at:string|null;snapshots:number;deleted:{id:number;table_name:string;record_id:number;created_at:string;title:string}[]};
export default function BackupPanel(){
 const {t,date}=useLanguage();const [status,setStatus]=useState<Status|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){setError('');try{setStatus(await api('/api/admin/backup'));}catch(e){setError(errorKey(e));}}
 useEffect(()=>{void load();},[]);
 async function download(){setBusy(true);setError('');try{
  const backup=await api('/api/admin/backup',{method:'POST'});
  if(backup?.format!=='scientarium-application-backup-v1'||!backup.tables)throw new Error('Invalid backup');
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`scientarium-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(errorKey(e));}finally{setBusy(false);}}
 async function restore(id:number,title:string){if(!window.confirm(`${t('restoreConfirm')}\n${title}`))return;setBusy(true);setError('');try{await api('/api/admin/backup/restore',{method:'POST',body:JSON.stringify({revision_id:id})});await load();}catch(e){setError(errorKey(e));}finally{setBusy(false);}}
 return <section className="space-y-5"><div className="panel space-y-4"><h2 className="section-title">{t('backups')}</h2><p className="muted text-sm">{t('backupHint')}</p>{status&&<p className="text-sm">{t('lastBackup')}: {status.last_backup_at?date(status.last_backup_at,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'—'} · {status.snapshots}/3</p>}<button disabled={busy||!status} className="button" onClick={download}><Download size={18}/>{t(busy?'loading':'downloadBackup')}</button><p className="help">{t('backupPrivate')}</p></div>{error&&<p className="notice error" role="alert">{t(error)} <button className="underline" onClick={load}>{t('retry')}</button></p>}<div className="panel space-y-4"><h2 className="section-title">{t('deletedRecords')}</h2><p className="help">{t('restoreHint')}</p>{!status?<p>{t('loading')}</p>:!status.deleted.length?<p className="muted">{t('noDeleted')}</p>:<ul className="space-y-4">{status.deleted.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{row.title}</p><p className="help">{t(row.table_name==='events'?'events':'universities')} · {date(row.created_at)}</p></div><button className="button secondary" disabled={busy} onClick={()=>restore(row.id,row.title)}><RotateCcw size={16}/>{t('restore')}</button></li>)}</ul>}</div></section>;
}
