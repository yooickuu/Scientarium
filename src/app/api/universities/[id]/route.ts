import {NextRequest,NextResponse} from 'next/server';
import db from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {guardMutation,readJson,InputError} from '@/lib/request-security';
import {universityInput} from '@/lib/universities';
type Context={params:Promise<{id:string}>};
export async function PUT(req:NextRequest,{params}:Context){
  const blocked=guardMutation(req);if(blocked)return blocked;
  if((await getCurrentUser())?.role!=='admin')return NextResponse.json({error:'Доступ запрещён'},{status:403});
  const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'ID'},{status:400});
  if(!db.prepare('SELECT id FROM universities WHERE id=?').get(id))return NextResponse.json({error:'Не найдено'},{status:404});
  try{const data=universityInput(await readJson(req));const keys=Object.keys(data);db.transaction(()=>{db.prepare(`UPDATE universities SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>data[k]),id);db.prepare('UPDATE events SET university=? WHERE university_id=?').run(data.name,id);})();return NextResponse.json({ok:true});}catch(error){const duplicate=String(error).includes('UNIQUE');return NextResponse.json({error:'Ошибка',code:duplicate?'alreadyExists':error instanceof InputError?error.message:'requestError'},{status:duplicate?409:error instanceof InputError?400:500});}
}
export async function DELETE(req:NextRequest,{params}:Context){
  const blocked=guardMutation(req,false);if(blocked)return blocked;
  if((await getCurrentUser())?.role!=='admin')return NextResponse.json({error:'Доступ запрещён'},{status:403});
  const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'ID'},{status:400});
  const result=db.prepare('DELETE FROM universities WHERE id=?').run(id);
  return result.changes?NextResponse.json({ok:true}):NextResponse.json({error:'Не найдено'},{status:404});
}
