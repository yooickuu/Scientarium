import {cookies} from 'next/headers';
import {localizeEvent} from '@/lib/i18n/messages';
import {notFound} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import {eventById} from '@/lib/events-store';
import EventDetails from '@/components/EventDetails';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {
  const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return {};
  const event=eventById(id);if(!event)return {};
  const value=(await cookies()).get('scientarium_locale')?.value;
  const localized=localizeEvent(event,value==='kk'||value==='en'?value:'ru');
  return {title:localized.title+' — Scientarium',description:localized.description.slice(0,180)};
}
export default async function EventPage({params}:{params:Promise<{id:string}>}){const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();const user=await getCurrentUser();const event=eventById(id,user?.id);if(!event)notFound();return <EventDetails event={event}/>;}
