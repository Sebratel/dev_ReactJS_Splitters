import { createBrowserRouter } from 'react-router-dom'
import { ProtectedAppLayout } from '@/app/auth/ProtectedAppLayout'
import { PermissionGuard } from '@/app/auth/PermissionGuard'
import { RootLayout } from '@/app/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { SplittersPage } from '@/pages/SplittersPage'
import { SplitterDetailPage } from '@/pages/SplitterDetailPage'
import { ClienteDetailPage } from '@/pages/ClienteDetailPage'
import { MassivaPage } from '@/pages/MassivaPage'
import { NetworkIntelligencePage } from '@/pages/NetworkIntelligencePage'
import { OidcCallbackPage } from '@/pages/OidcCallbackPage'
import { LoginPage } from '@/pages/LoginPage'
import { UsersManagementPage } from '@/pages/UsersManagementPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
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
          {
            path: 'massiva',
            element: (
              <PermissionGuard
                permission="canViewMassiva"
                description="Seu perfil não possui acesso ao módulo de massivas."
              >
                <MassivaPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'intelligence',
            element: (
              <PermissionGuard
                permission="canViewIntelligence"
                description="Seu perfil não possui acesso ao painel de inteligência."
              >
                <NetworkIntelligencePage />
              </PermissionGuard>
            ),
          },
          /*{
            path: 'usuarios',
            element: (
              <PermissionGuard
                permission="isAdmin"
                description="Somente administradores podem acessar a gestão de usuários."
              >
                <UsersManagementPage />
              </PermissionGuard>
            ),
          },*/
        ],
      },
    ],
  },
])
