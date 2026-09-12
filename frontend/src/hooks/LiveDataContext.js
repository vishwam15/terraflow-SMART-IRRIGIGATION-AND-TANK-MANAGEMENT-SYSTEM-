import { createContext, useContext } from 'react';

export const LiveDataContext = createContext(null);

export function useLive() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) {
    throw new Error('useLive must be used within a DashboardLayout');
  }
  return ctx;
}
