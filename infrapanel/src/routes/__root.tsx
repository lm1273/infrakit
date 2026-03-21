/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/style.css?url'
import { seo } from '~/utils/seo'
import { checkAuth, logout } from '~/utils/auth'
import { LogOut } from 'lucide-react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'InfraPanel – Rendszer Műszerfal',
        description: 'InfraKit infrastruktúra menedzsment műszerfal. Valós idejű szolgáltatás monitoring és kezelés.',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return;
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const isLoginPage = typeof window !== 'undefined' ? window.location.pathname === '/login' : false;

  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <main className="mx-auto max-w-7xl p-6">
          {!isLoginPage && <Navbar />}
          {children}
        </main>

        <Scripts />
      </body>
    </html>
  )
}

function Navbar() {
  const router = useRouter();
  const handleLogout = async () => {
    await logout();
    router.invalidate();
    router.navigate({ to: '/login' });
  };

  return (
    <nav className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-6 py-3 flex justify-between items-center mb-6 rounded-lg shadow-sm">
      <div className="font-bold text-xl text-slate-800 dark:text-white tracking-tight">InfraPanel</div>
      <button 
        onClick={handleLogout}
        className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Kijelentkezés
      </button>
    </nav>
  );
}
