/**
 * Renderizador de fluxogramas (Mermaid), carregado da CDN uma vez e reaproveitado.
 * Fica fora dos componentes para ser usado pela seção do fluxograma e pela apresentação ao Comitê.
 */
let mermaidLoadPromise: Promise<void> | null = null

export function loadMermaid(): Promise<void> {
  if (mermaidLoadPromise) return mermaidLoadPromise
  mermaidLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { resolve(); return }
    // Já carregado
    if ((window as Window & { mermaid?: unknown }).mermaid) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js'
    script.onload = () => {
      try {
        (window as Window & { mermaid?: { initialize: (cfg: object) => void } }).mermaid?.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          themeVariables: { fontSize: '14px' },
          flowchart: { rankSpacing: 70, nodeSpacing: 50, curve: 'basis', padding: 24 },
        })
      } catch { /* ignore */ }
      resolve()
    }
    script.onerror = () => {
      mermaidLoadPromise = null // permite nova tentativa
      reject(new Error('Falha ao carregar o renderizador de fluxogramas. Verifique sua conexão.'))
    }
    document.head.appendChild(script)
  })
  return mermaidLoadPromise
}

export async function renderMermaid(source: string, container: HTMLElement): Promise<void> {
  await loadMermaid()
  const mermaid = (window as Window & { mermaid?: { render: (id: string, src: string) => Promise<{ svg: string }> } }).mermaid
  if (!mermaid) throw new Error('Mermaid não disponível.')
  const id = `mermaid-${Date.now()}`
  let svg: string
  try {
    ;({ svg } = await mermaid.render(id, source))
  } finally {
    // Remove o container temporário que o Mermaid cria no <body> (id="d{id}") — nunca o SVG renderizado
    document.getElementById(`d${id}`)?.remove()
  }
  container.innerHTML = svg!
}
