import { ApiError } from './api-error';
import { usesSupabase } from './paths';
export { ApiError } from './api-error';
export async function api<T=any>(url:string,options:RequestInit={}):Promise<T>{
  if (usesSupabase) {
    const { supabaseApi } = await import('./supabase-api');
    return supabaseApi(url, options) as Promise<T>;
  }
  const response=await fetch(url,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new ApiError(data.code||(response.status===429?'rateLimit':response.status===403?'forbidden':response.status===401?'loginRequired':'requestError'),response.status);
  return data;
}
export function errorKey(error:unknown){return error instanceof ApiError?error.code:'requestError';}
export async function resizeImage(file:File,maxWidth=1200,maxHeight=800):Promise<string>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('imageError');
  const url=URL.createObjectURL(file);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const scale=Math.min(maxWidth/image.width,maxHeight/image.height,1);const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('imageError'));return;}ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',0.82));};image.onerror=()=>reject(new Error('imageError'));image.src=url;});}finally{URL.revokeObjectURL(url);}
}
