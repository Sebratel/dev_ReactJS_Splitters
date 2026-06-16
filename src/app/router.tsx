import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedAppLayout } from '@/app/auth/ProtectedAppLayout'
import { PermissionGuard } from '@/app/auth/PermissionGuard'
import { RootLayout } from '@/app/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { OidcCallbackPage } from '@/pages/OidcCallbackPage'
import { LoginPage } from '@/pages/LoginPage'

const SplittersPage = lazy(() =>
  import('@/pages/SplittersPage').then((m) => ({ default: m.SplittersPage })),
)
const SplitterDetailPage = lazy(() =>
  import('@/pages/SplitterDetailPage').then((m) => ({ default: m.SplitterDetailPage })),
)
const ClienteDetailPage = lazy(() =>
  import('@/pages/ClienteDetailPage').then((m) => ({ default: m.ClienteDetailPage })),
)
const MassivaPage = lazy(() =>
  import('@/pages/MassivaPage').then((m) => ({ default: m.MassivaPage })),
)
const NetworkIntelligencePage = lazy(() =>
  import('@/pages/NetworkIntelligencePage').then((m) => ({ default: m.NetworkIntelligencePage })),
)
const UsersManagementPage = lazy(() =>
  import('@/pages/UsersManagementPage').then((m) => ({ default: m.UsersManagementPage })),
)
const IsaSettingsPage = lazy(() =>
  import('@/pages/IsaSettingsPage').then((m) => ({ default: m.IsaSettingsPage })),
)
const PlatformSuggestionsPage = lazy(() =>
  import('@/pages/PlatformSuggestionsPage').then((m) => ({ default: m.PlatformSuggestionsPage })),
)

function Page({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

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
          { path: 'splitters', element: <Page><SplittersPage /></Page> },
          { path: 'sugestoes', element: <Page><PlatformSuggestionsPage /></Page> },
          {
            path: 'splitters/:code',
            element: <Page><SplitterDetailPage /></Page>,
          },
          { path: 'clientes/:id', element: <Page><ClienteDetailPage /></Page> },
          {
            path: 'massiva',
            element: (
              <PermissionGuard
                permission="canViewMassiva"
                description="Seu perfil não possui acesso ao módulo de massivas."
              >
                <Page><MassivaPage /></Page>
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
                <Page><NetworkIntelligencePage /></Page>
              </PermissionGuard>
            ),
          },
          {
            path: 'usuarios',
            element: (
              <PermissionGuard
                permission="isAdmin"
                description="Somente administradores podem acessar a gestão de usuários."
              >
                <Page><UsersManagementPage /></Page>
              </PermissionGuard>
            ),
          },
          {
            path: 'isa-config',
            element: (
              <PermissionGuard
                permission="isAdmin"
                description="Somente administradores podem acessar a configuração da ISA."
              >
                <Page><IsaSettingsPage /></Page>
              </PermissionGuard>
            ),
          },
        ],
      },
    ],
  },
])
