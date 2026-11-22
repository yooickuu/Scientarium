import {notFound} from 'next/navigation';
import EventEditor from '@/components/EventEditor';
export default async function EditEvent({params}:{params:Promise<{id:string}>}){const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();return <EventEditor eventId={id}/>;}
