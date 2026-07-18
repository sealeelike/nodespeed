import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { Layout } from './pages/Layout'
import { NodesPage } from './pages/NodesPage'
import { TestPage } from './pages/TestPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/nodes" replace /> },
      { path: 'nodes', element: <NodesPage /> },
      { path: 'test', element: <TestPage /> },
      { path: '*', element: <Navigate to="/nodes" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
