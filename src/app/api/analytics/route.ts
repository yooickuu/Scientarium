import {NextRequest,NextResponse} from 'next/server';
import {createHmac,randomUUID} from 'node:crypto';
import db from '@/lib/db';
import {getCurrentUser,getJwtSecret} from '@/lib/auth';
import {guardMutation,readJson,InputError} from '@/lib/request-security';
export async function POST(req:NextRequest){
  const blocked=guardMutation(req);if(blocked)return blocked;
  try{
    const body=await readJson(req,2048);
    if(typeof body.path!=='string'||!/^\/(?:calendar|bookmarks|profile|events\/[1-9]\d*)?$/.test(body.path)||typeof body.view_id!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(body.view_id))throw new InputError('invalidInput');
    // Staff actions, API polling and prefetches are not visitor page views.
    const user=await getCurrentUser();if(user&&user.role!=='user')return NextResponse.json({ok:true,counted:false});
    const eventMatch=body.path.match(/^\/events\/(\d+)$/);
    if(eventMatch&&!db.prepare('SELECT id FROM events WHERE id=?').get(Number(eventMatch[1])))return NextResponse.json({ok:true,counted:false});
    const existingCookie=req.cookies.get('scientarium_visit')?.value;
    const session=existingCookie&&/^[a-f0-9-]{36}$/.test(existingCookie)?existingCookie:randomUUID();
    const sessionHash=createHmac('sha256',getJwtSecret()).update(session).digest('hex');
    const now=Date.now();const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const count=db.transaction(()=>{
      db.prepare('DELETE FROM analytics_visits WHERE created_at < ?').run(now-90*86400000);
      const recent=db.prepare('SELECT COUNT(*) AS n FROM analytics_visits WHERE session_hash=? AND created_at>?').get(sessionHash,now-60000) as {n:number};
      if(recent.n>=30)return false;
      const result=db.prepare('INSERT OR IGNORE INTO analytics_visits(view_id,session_hash,path,day,device,created_at) VALUES(?,?,?,?,?,?)').run(body.view_id,sessionHash,body.path,day,body.device==='mobile'?'mobile':'desktop',now);
      if(result.changes&&eventMatch)db.prepare('UPDATE events SET views_count=views_count+1 WHERE id=?').run(Number(eventMatch[1]));
      return Boolean(result.changes);
    })();
    const response=NextResponse.json({ok:true,counted:count});
    response.cookies.set('scientarium_visit',session,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:1800});
    return response;
  }catch(error){return NextResponse.json({error:'Invalid visit'},{status:error instanceof InputError?400:500});}
}
