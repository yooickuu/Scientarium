import {cp, mkdir, rm, symlink, writeFile, readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import nextEnv from '@next/env';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
nextEnv.loadEnvConfig(root);
const settings=JSON.parse(await readFile(path.join(root,'config/public.json'),'utf8'));
process.env.NEXT_PUBLIC_SUPABASE_URL ||= settings.supabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= settings.supabasePublishableKey;
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
if(key.startsWith('sb_secret_'))throw new Error('A secret key MUST NOT be used in the browser.');
if(!key.startsWith('sb_publishable_')){
  try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw new Error();}
  catch{throw new Error('Only a publishable key or legacy anon key is allowed.');}
}
const requestedBase=process.env.NEXT_PUBLIC_BASE_PATH||'';
const base=(process.env.PAGES_CUSTOM_DOMAIN||/\.github\.io\/?$/i.test(requestedBase)?'':requestedBase).replace(/\/$/,'');
if(base&&!/^\/[A-Za-z0-9._-]+$/.test(base))throw new Error('Base path must be empty or /repository-name.');
const stage=path.join(root,'.pages-build');
await rm(stage,{recursive:true,force:true});await mkdir(stage);
// Copy only source and public assets. Never copy .env, SQLite, backups or private files.
await cp(path.join(root,'src'),path.join(stage,'src'),{recursive:true,filter:source=>{
  const relative=path.relative(path.join(root,'src'),source).split(path.sep).join('/');
  return !['app/api','app/events/[id]','app/admin/events/[id]'].some(prefix=>relative===prefix||relative.startsWith(prefix+'/'));
}});
await cp(path.join(root,'public'),path.join(stage,'public'),{recursive:true});
for(const name of ['package.json','tsconfig.json','tailwind.config.ts','tailwind.config.js','postcss.config.js','postcss.config.mjs','next-env.d.ts']){
  if(existsSync(path.join(root,name)))await cp(path.join(root,name),path.join(stage,name));
}
await symlink(path.join(root,'node_modules'),path.join(stage,'node_modules'),'dir');
await writeFile(path.join(stage,'next.config.js'),`module.exports={output:'export',trailingSlash:true,basePath:${JSON.stringify(base)},images:{unoptimized:true},poweredByHeader:false};\n`);
// Only selected public values enter the child build, never the local server's secrets.
const env={...process.env,NEXT_PUBLIC_DATA_BACKEND:'supabase',NEXT_PUBLIC_BASE_PATH:base,NEXT_TELEMETRY_DISABLED:'1'};
for(const name of ['JWT_SECRET','OWNER_EMAIL','DATABASE_PATH','APP_ORIGIN','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete env[name];
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:stage,env,stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Static build failed: '+code)));
});
const out=path.join(root,'out');
await rm(out,{recursive:true,force:true});await cp(path.join(stage,'out'),out,{recursive:true});
await writeFile(path.join(out,'.nojekyll'),'');
if(process.env.PAGES_CUSTOM_DOMAIN){
  const domain=process.env.PAGES_CUSTOM_DOMAIN.trim();
  if(!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(domain))throw new Error('Invalid custom domain');
  await writeFile(path.join(out,'CNAME'),domain+'\n');
}
console.log('Static site ready in out/. Existing local server build and database were not changed.');
