import {NextRequest,NextResponse} from 'next/server';
import db from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  if((await getCurrentUser())?.role!=='admin')return NextResponse.json({error:'Доступ запрещён'},{status:403});
  const requested=Number(req.nextUrl.searchParams.get('days'));const days=[7,30,90].includes(requested)?requested:30;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'});
  const dates=Array.from({length:days},(_,i)=>date.format(Date.now()-(days-1-i)*86400000));
  const since=dates[0];
  const count=(sql:string,...args:(string|number)[])=>(db.prepare(sql).get(...args) as {n:number}).n;
  const daily=db.prepare('SELECT day,COUNT(*) AS views,COUNT(DISTINCT session_hash) AS sessions FROM analytics_visits WHERE day>=? GROUP BY day').all(since) as {day:string;views:number;sessions:number}[];
  return NextResponse.json({stats:{
    totalEvents:count('SELECT COUNT(*) AS n FROM events'),
    upcomingEvents:count('SELECT COUNT(*) AS n FROM events WHERE end_date>=?',new Date().toISOString()),
    totalUsers:count('SELECT COUNT(*) AS n FROM users WHERE is_active=1'),
    totalViews:count('SELECT COALESCE(SUM(views_count),0) AS n FROM events'),
    pageViews:count('SELECT COUNT(*) AS n FROM analytics_visits WHERE day>=?',since),
    sessions:count('SELECT COUNT(DISTINCT session_hash) AS n FROM analytics_visits WHERE day>=?',since),
    mobileViews:count("SELECT COUNT(*) AS n FROM analytics_visits WHERE day>=? AND device='mobile'",since),
    days,daily:dates.map(day=>daily.find(row=>row.day===day)||{day,views:0,sessions:0}),
    popularPages:db.prepare('SELECT path,COUNT(*) AS views FROM analytics_visits WHERE day>=? GROUP BY path ORDER BY views DESC LIMIT 8').all(since),
    categoryBreakdown:db.prepare('SELECT category,COUNT(*) AS count FROM events GROUP BY category').all(),
    formatBreakdown:db.prepare('SELECT format,COUNT(*) AS count FROM events GROUP BY format').all()
  }});
}
