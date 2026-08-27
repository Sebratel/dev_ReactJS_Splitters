import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedAppLayout } from '@/app/auth/ProtectedAppLayout'
import { ProtectedRoute } from '@/app/auth/ProtectedRoute'
import { PermissionGuard } from '@/app/auth/PermissionGuard'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
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
const MassivaLayoutPage = lazy(() =>
  import('@/pages/MassivaLayoutPage').then((m) => ({ default: m.MassivaLayoutPage })),
)
const MassivaPage = lazy(() =>
  import('@/pages/MassivaPage').then((m) => ({ default: m.MassivaPage })),
)
const MassivaDashboardPage = lazy(() =>
  import('@/pages/MassivaDashboardPage').then((m) => ({ default: m.MassivaDashboardPage })),
)
const MassivaMonitorPage = lazy(() =>
  import('@/pages/MassivaMonitorPage').then((m) => ({ default: m.MassivaMonitorPage })),
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
const CondoRedistributionPage = lazy(() =>
  import('@/pages/CondoRedistributionPage').then((m) => ({ default: m.CondoRedistributionPage })),
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
    // Painel de parede (CGR/COR) — rota isolada, fora do RootLayout/Sidebar de
    // propósito: precisa ocupar a tela inteira num monitor físico, sem chrome do app.
    path: '/massiva/monitor',
    element: (
      <ProtectedRoute>
        <PermissionGuard
          permission="canViewMassiva"
          description="Seu perfil não possui acesso ao módulo de massivas."
        >
          <Page><MassivaMonitorPage /></Page>
        </PermissionGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
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
            path: 'redistribuicao-condominios',
            element: (
              <PermissionGuard
                permission="canViewRedistribution"
                allowAdmin
                description="Seu perfil não possui acesso à tela de redistribuição."
              >
                <Page><CondoRedistributionPage /></Page>
              </PermissionGuard>
            ),
          },
          {
            path: 'massiva',
            element: (
              <PermissionGuard
                permission="canViewMassiva"
                description="Seu perfil não possui acesso ao módulo de massivas."
              >
                <Page><MassivaLayoutPage /></Page>
              </PermissionGuard>
            ),
            children: [
              { index: true, element: <Page><MassivaPage /></Page> },
              { path: 'dashboard', element: <Page><MassivaDashboardPage /></Page> },
            ],
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
  // Qualquer rota não encontrada → tela amigável (em vez do erro cru do React Router)
  { path: '*', element: <RouteErrorBoundary /> },
])
