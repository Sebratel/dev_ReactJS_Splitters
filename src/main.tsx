import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/shared/config/i18n'
import App from '@/app/App'
import { bootstrapSession } from '@/features/session/lib/bootstrapSession'
import { preloadAccessRequestFabImage, preloadIsaHeroImage } from '@/shared/lib/accessRequestFabImage'

/**
 * Mitiga erro de chunk desatualizado após deploy (hash mudou no servidor).
 * O Vite emite `vite:preloadError`; recarregar a página resolve para o usuário.
 */
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

bootstrapSession()
preloadAccessRequestFabImage()
preloadIsaHeroImage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

