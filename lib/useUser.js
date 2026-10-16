'use client';
// Hook that asks the server who is logged in. user is undefined while loading, null if logged out.
import { useEffect, useState } from 'react';
import { api } from './api';

export function useUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { api('/api/me').then(setUser).catch(() => setUser(null)); }, []);
  return user;
}
