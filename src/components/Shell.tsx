import {ReactNode} from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
export default function Shell({children}:{children:ReactNode}){return <div className="shell"><Navbar/><main className="content enter">{children}</main><Footer/><MobileBottomNav/></div>;}
