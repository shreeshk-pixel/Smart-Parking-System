'use client';
// App shell for parking customers (find parking, my bookings).
import AppShell from './AppShell';

const items = [
  { href: '/', icon: 'map', text: 'Find parking', api: '/api/locations' },
  { href: '/my-bookings', icon: 'ticket', text: 'My bookings', api: '/api/my_bookings' },
];
const menu = { label: 'Parking', items };
const tabs = [{ ...items[0], text: 'Find' }, { ...items[1], text: 'Bookings' }];
const warmUrls = () => ['/api/locations', '/api/my_bookings'];
const warmCode = () => import('./FindParking'); // the map code is the biggest chunk: fetch it early

export default function CustomerShell({ children }) {
  return <AppShell role="customer" home="/" menu={menu} tabs={tabs} warmUrls={warmUrls} warmCode={warmCode}>{children}</AppShell>;
}
