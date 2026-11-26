'use client';
// Find Parking. Leaflet needs the browser's `window`, so the map component is loaded only on the client.
import dynamic from 'next/dynamic';
const FindParking = dynamic(() => import('../../components/FindParking'), { ssr: false, loading: () => <p className="muted">Loading map…</p> });

export default function HomePage() {
  return <FindParking />;
}
