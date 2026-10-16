'use client';
// Scan page. html5-qrcode uses the camera, so it is loaded only in the browser.
import dynamic from 'next/dynamic';
const Scanner = dynamic(() => import('../../../components/Scanner'), { ssr: false });

export default function ScanPage() {
  return <><h1>Entry / Exit Scan</h1><Scanner /></>;
}
