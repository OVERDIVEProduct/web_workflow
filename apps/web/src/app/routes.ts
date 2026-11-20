/** 單一來源：全站連結與 React Router 共用的路徑常數 */
export const ROUTES = {
  dashboard: '/dashboard',
  workflows: '/workflows',
  workflow: (id: string) => `/workflows/${encodeURIComponent(id)}`,
  settings: '/settings',
  profile: '/profile',
} as const;
