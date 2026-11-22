import {NextRequest,NextResponse} from 'next/server';
import db from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {guardMutation,readJson,InputError} from '@/lib/request-security';
import {universityInput} from '@/lib/universities';
import {University} from '@/types';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
  const all=req.nextUrl.searchParams.get('manage')==='1';
  if(all&&(await getCurrentUser())?.role!=='admin')return NextResponse.json({error:'Доступ запрещён'},{status:403});
  const rows=db.prepare(`SELECT * FROM universities ${all?'':'WHERE is_active=1'} ORDER BY name`).all() as University[];
  return NextResponse.json({universities:rows.map(row=>({...row,is_active:Boolean(row.is_active)}))});
}
export async function POST(req:NextRequest) {
  const blocked=guardMutation(req);if(blocked)return blocked;
  if((await getCurrentUser())?.role!=='admin')return NextResponse.json({error:'Доступ запрещён'},{status:403});
  try {
    const data=universityInput(await readJson(req));const keys=Object.keys(data);
    const result=db.prepare(`INSERT INTO universities (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>data[k]));
    return NextResponse.json({university:db.prepare('SELECT * FROM universities WHERE id=?').get(result.lastInsertRowid)},{status:201});
  }catch(error){const duplicate=String(error).includes('UNIQUE');return NextResponse.json({error:'Не удалось сохранить вуз',code:duplicate?'alreadyExists':error instanceof InputError?error.message:'requestError'},{status:duplicate?409:error instanceof InputError?400:500});}
}
