const protectedPages = Object.freeze({
  '/dashboard': 'home',
  '/reminders': 'medicine',
  '/mood': 'mood',
  '/activities': 'activities',
  '/contacts': 'contacts',
  '/care-plan': 'carePlan',
  '/summary': 'summary',
  '/weekly-report': 'weeklyReport',
  '/assistant': 'assistant',
})

export function resolveAppRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const publicPages = Object.freeze({ '/': 'home', '/about': 'about', '/features': 'features', '/contact': 'contact' })
  if (Object.hasOwn(publicPages, path)) return { kind: 'public', page: publicPages[path] }
  if (path === '/login') return { kind: 'login' }
  if (path === '/register') return { kind: 'register' }
  if (Object.hasOwn(protectedPages, path)) return { kind: 'protected', page: protectedPages[path] }
  return { kind: 'landing' }
}
