'use client';
// Small Leaflet map: click anywhere to choose the latitude/longitude of a new parking location.
import { useEffect, useRef } from 'react';
import L from 'leaflet';

// props: lat, lng (current values), onPick(lat, lng) called when the map is clicked
export default function LocationPicker({ lat, lng, onPick }) {
  const div = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  // Build the map once
  useEffect(() => {
    map.current = L.map(div.current).setView([15.8497, 74.4977], 13); // Belagavi
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map.current);
    map.current.on('click', e => onPick(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)));
    return () => map.current.remove();
  }, []); // eslint-disable-line

  // Move the marker whenever lat/lng change (from a click or from typing)
  useEffect(() => {
    const a = Number(lat), b = Number(lng);
    if (lat === '' || lng === '' || !isFinite(a) || !isFinite(b)) return;
    if (!marker.current) marker.current = L.circleMarker([a, b], { radius: 10, color: 'blue' }).addTo(map.current);
    else marker.current.setLatLng([a, b]);
  }, [lat, lng]);

  return <div ref={div} style={{ height: 320, borderRadius: 8, marginBottom: 12 }} />;
}
