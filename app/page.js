'use client';
// Map page. Leaflet needs the browser's `window`, so the map is loaded only on the client (ssr: false).
import dynamic from 'next/dynamic';
const MapBooking = dynamic(() => import('../components/MapBooking'), { ssr: false, loading: () => <p>Loading map…</p> });

export default function HomePage() {
  return <><h1>Find Parking</h1><MapBooking /></>;
}
