import {Suspense} from 'react';
import EventQueryPage from '@/components/EventQueryPage';
export default function EditEvent(){return <Suspense fallback={null}><EventQueryPage edit/></Suspense>;}
