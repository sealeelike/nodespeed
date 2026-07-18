import { useOutletContext } from 'react-router-dom'

// shared between the layout route and its pages via <Outlet context>
export type LayoutCtx = { dark: boolean; toggleDark: () => void }

export const useLayout = () => useOutletContext<LayoutCtx>()
