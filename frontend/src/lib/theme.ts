import { useEffect, useState } from 'react'

// Persisted light/dark theme. Defaults to the OS preference, then remembers the
// user's explicit choice in localStorage. Applies `.dark` on <html>.
export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('nodespeed-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('nodespeed-theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark((d) => !d)]
}
