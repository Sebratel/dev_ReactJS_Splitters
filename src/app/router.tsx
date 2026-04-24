import { createBrowserRouter } from 'react-router-dom'
import { ProtectedAppLayout } from '@/app/auth/ProtectedAppLayout'
import { RootLayout } from '@/app/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { SplittersPage } from '@/pages/SplittersPage'
import { SplitterDetailPage } from '@/pages/SplitterDetailPage'
import { ClienteDetailPage } from '@/pages/ClienteDetailPage'
import { MassivaPage } from '@/pages/MassivaPage'
import { NetworkIntelligencePage } from '@/pages/NetworkIntelligencePage'
import { OidcCallbackPage } from '@/pages/OidcCallbackPage'

export const router = createBrowserRouter([
  {
    path: '/callback',
    element: <OidcCallbackPage />,
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <ProtectedAppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'splitters', element: <SplittersPage /> },
          {
            path: 'splitters/:code',
            element: <SplitterDetailPage />,
          },
          { path: 'clientes/:id', element: <ClienteDetailPage /> },
          { path: 'massiva', element: <MassivaPage /> },
          { path: 'intelligence', element: <NetworkIntelligencePage /> },
        ],
      },
    ],
  },
])
