'use client';
// App shell for the admin pages. Only app/(admin) imports this, so the admin menu is never sent to customers.
import AppShell from './AppShell';
import { reportUrl } from '../lib/adminApi';

const items = [
  { href: '/admin', icon: 'dash', text: 'Dashboard', api: '/api/admin_stats' },
  { href: '/admin/locations', icon: 'pin', text: 'Locations', api: '/api/admin/locations' },
  { href: '/admin/slots', icon: 'grid', text: 'Slots', api: '/api/admin/slots' },
  { href: '/admin/scan', icon: 'scan', text: 'Scan pass' },
  { href: '/admin/reports', icon: 'report', text: 'Reports', api: () => reportUrl() },
  { href: '/admin/activity', icon: 'clock', text: 'Activity log' },
];
const menu = { label: 'Admin', items };
const tabs = [items[0], items[2], { ...items[3], text: 'Scan' }, items[4]];
const warmUrls = () => ['/api/admin_stats', '/api/admin/slots', '/api/admin/locations', reportUrl()];

export default function AdminShell({ children }) {
  return <AppShell role="admin" home="/admin" menu={menu} tabs={tabs} warmUrls={warmUrls}>{children}</AppShell>;
}
