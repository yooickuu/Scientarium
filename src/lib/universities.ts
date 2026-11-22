import { InputError } from './request-security';
export function universityInput(body:Record<string,unknown>) {
  const data:Record<string,string|number>={};
  for(const key of ['name','name_kk','name_en','country','city','website','description']) {
    const value=body[key]??'';
    if(typeof value!=='string'||value.length>(key==='description'?3000:300))throw new InputError('invalidInput');
    data[key]=value.trim();
  }
  if(!data.name)throw new InputError('invalidInput');
  data.name_key=String(data.name).normalize('NFKC').toLowerCase();
  if(data.website) {try {const url=new URL(String(data.website));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();}catch{throw new InputError('invalidUrl');}}
  const relationship = body.relationship !== undefined && body.relationship !== '' ? String(body.relationship) : 'partner';
  if(!['partner','participant'].includes(relationship))throw new InputError('invalidInput');
  data.relationship=relationship;
  if(body.is_active!==undefined&&typeof body.is_active!=='boolean')throw new InputError('invalidInput');
  data.is_active=body.is_active===false?0:1;
  return data;
}
