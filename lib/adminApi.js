// Admin-only client helpers. Imported only by admin pages (app/(admin)), so customers' browsers never
// download this file.
import { istDay } from './api';

// Reports page URL for a date range (default: the last 30 days, in IST) - shared so the admin shell can warm it
export const reportUrl = (from = istDay(-30), to = istDay()) => `/api/admin/report?from=${from}&to=${to}`;
