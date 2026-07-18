import { Outlet } from 'react-router-dom'
import { useDarkMode } from '../lib/theme'
import type { LayoutCtx } from '../lib/layoutContext'

// Shared chrome for every route: header + dark toggle + footer, with the page
// rendered through <Outlet>. useDarkMode is called exactly once here so both
// pages share one source of truth; dark/toggle flow down via Outlet context.
export function Layout() {
  const [dark, toggleDark] = useDarkMode()
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NodeSpeed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Link quality from your browser to your own VPS nodes</p>
        </div>
        <button
          onClick={toggleDark}
          className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      <Outlet context={{ dark, toggleDark } satisfies LayoutCtx} />

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400 dark:border-gray-800">
        NodeSpeed · self-hosted link-quality panel · powered by the @cloudflare/speedtest engine
      </footer>
    </div>
  )
}
