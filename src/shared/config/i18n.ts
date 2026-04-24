import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from '../assets/locales/pt-BR.json'
import enUS from '../assets/locales/en-US.json'

/**
 * Inicializa a infraestrutura de multi-idioma.
 * Paridade com o sistema de l10n do Flutter.
 */
i18n
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': {
        translation: ptBR,
      },
      'en-US': {
        translation: enUS,
      },
    },
    lng: localStorage.getItem('lng') || 'pt-BR', // Persistência simples do idioma
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false, // React já protege contra XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
