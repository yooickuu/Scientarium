import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { guardMutation, readJson, InputError } from '@/lib/request-security';
export const dynamic='force-dynamic';
const COOLDOWN=30*24*60*60*1000;
export async function PATCH(req:NextRequest) {
  const blocked=guardMutation(req);if(blocked)return blocked;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Необходим вход',code:'loginRequired'},{status:401});
  try {
    const body=await readJson(req,500000);
    const fields:Record<string,string>={};
    for(const field of ['full_name','university','specialty']) {
      if(!(field in body))continue;
      if(typeof body[field]!=='string'||body[field].trim().length>150||(field==='full_name'&&!body[field].trim()))throw new InputError('invalidInput');
      fields[field]=body[field].trim();
    }
    if('account_category' in body) {
      if(typeof body.account_category!=='string'||!['unspecified','medical_student','postgraduate','researcher','doctor','other'].includes(body.account_category))throw new InputError('invalidInput');
      fields.account_category=body.account_category;
    }
    if('nickname' in body) {
      if(typeof body.nickname!=='string')throw new InputError('nicknameRules');
      const nickname=body.nickname.trim().toLowerCase();
      if(nickname && !/^[a-z][a-z0-9_]{2,23}$/.test(nickname))throw new InputError('nicknameRules');
      if(nickname!==(user.nickname||'') && !nickname)throw new InputError('nicknameRules');
      fields.nickname=nickname;
    }
    if('avatar_url' in body) {
      if(typeof body.avatar_url!=='string'||body.avatar_url.length>400000)throw new InputError('imageError');
      const image=body.avatar_url;
      if(image) {
        const match=image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
        if(!match)throw new InputError('imageError');
        const bytes=Buffer.from(match[2],'base64');
        const valid=match[1]==='jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255])):match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
        if(!valid)throw new InputError('imageError');
      }
      fields.avatar_url=image;
    }
    const failure=db.transaction(()=>{
      const current=db.prepare('SELECT nickname,nickname_changed_at FROM users WHERE id=?').get(user.id) as {nickname:string|null;nickname_changed_at:string|null};
      if(fields.nickname!==undefined && fields.nickname!==(current.nickname||'')) {
        const next=current.nickname_changed_at ? Date.parse(current.nickname_changed_at)+COOLDOWN : 0;
        if(next>Date.now())return {code:'nicknameCooldown',next_change_at:new Date(next).toISOString()};
        const taken=db.prepare('SELECT id FROM users WHERE nickname=? COLLATE NOCASE AND id<>?').get(fields.nickname,user.id);
        if(taken)return {code:'nicknameTaken'};
        fields.nickname_changed_at=new Date().toISOString();
      }
      const keys=Object.keys(fields);
      if(keys.length)db.prepare(`UPDATE users SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>fields[k]),user.id);
      return null;
    })();
    if(failure)return NextResponse.json({error:failure.code,...failure},{status:409});
    return NextResponse.json({user:await getCurrentUser()});
  }catch(error){return NextResponse.json({error:'Не удалось сохранить профиль',code:error instanceof InputError?error.message:'requestError'},{status:error instanceof InputError?400:500});}
}
