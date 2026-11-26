'use client';
// Gate scan page. The camera library needs the browser, so the scanner is loaded only on the client.
import dynamic from 'next/dynamic';
const Scanner = dynamic(() => import('../../../../components/Scanner'), { ssr: false, loading: () => <p className="muted">Loading scanner…</p> });

export default function ScanPage() {
  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Gate</span><h1>Entry / exit <b>scan</b></h1><p>First scan of a paid pass = entry. Second scan = exit, which issues a one-time OTP.</p></div>
      </div>
      <Scanner />
    </>
  );
}
