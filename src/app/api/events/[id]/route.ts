import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { parseEvent } from '@/lib/event-validation';
import { guardMutation, readJson, InputError } from '@/lib/request-security';
import { eventById, canEditEvent, EVENT_FIELDS } from '@/lib/events-store';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{id:string}> };
export async function GET(req: NextRequest, {params}: Context) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({error:'Некорректный ID'}, {status:400});
  const user = await getCurrentUser();
  const event = eventById(id, user?.id);
  return event ? NextResponse.json({event}) : NextResponse.json({error:'Событие не найдено'}, {status:404});
}
export async function PUT(req: NextRequest, {params}: Context) {
  const blocked=guardMutation(req); if(blocked) return blocked;
  try {
    const id=Number((await params).id);
    if (!Number.isSafeInteger(id) || id<1) return NextResponse.json({error:'Некорректный ID'}, {status:400});
    const user=await getCurrentUser();
    if(!user || user.role==='user') return NextResponse.json({error:'Недостаточно прав'}, {status:403});
    const existing=eventById(id);
    if(!existing) return NextResponse.json({error:'Событие не найдено'}, {status:404});
    if(!canEditEvent(user,existing)) return NextResponse.json({error:'Можно редактировать только свои события'}, {status:403});
    const body=parseEvent(await readJson(req,2*1024*1024),existing);
    const fields=EVENT_FIELDS.filter(field=>body[field]!==undefined);
    if(fields.length) db.prepare(`UPDATE events SET ${fields.map(field=>`${field}=?`).join(',')} WHERE id=?`).run(...fields.map(field=>field==='is_featured' ? (body[field]?1:0) : body[field]),id);
    return NextResponse.json({event:eventById(id,user.id)});
  } catch(error) {return NextResponse.json({error:error instanceof InputError?error.message:'Ошибка сохранения'}, {status:error instanceof InputError?400:500});}
}
export async function DELETE(req: NextRequest,{params}:Context) {
  const blocked=guardMutation(req,false);if(blocked)return blocked;
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Некорректный ID'},{status:400});
  const user=await getCurrentUser();
  if(!user||user.role==='user')return NextResponse.json({error:'Недостаточно прав'},{status:403});
  const event=eventById(id);
  if(!event)return NextResponse.json({error:'Событие не найдено'},{status:404});
  if(!canEditEvent(user,event))return NextResponse.json({error:'Можно удалять только свои события'},{status:403});
  db.prepare('DELETE FROM events WHERE id=?').run(id);
  return NextResponse.json({ok:true});
}
