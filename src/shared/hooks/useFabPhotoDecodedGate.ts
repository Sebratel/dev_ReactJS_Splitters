import { useLayoutEffect, useState } from 'react'

/**
 * Controla quando o chrome do FAB (foto ISA) pode aparecer.
 * Imagens em cache costumam não disparar `onLoad` ao remontar — um `Image()` em `useLayoutEffect`
 * deteta `complete` antes da pintura e evita FAB “invisível” ao voltar de outra rota.
 *
 * Usa `onload`/`onerror` no probe: só checar `complete` de forma síncrona após `src=` falha quando
 * o decode ainda está pendente (alguns browsers / políticas), deixando a foto com opacity 0 para sempre.
 */
export function useFabPhotoDecodedGate(showPhotoFab: boolean, fabImageSrc: string) {
  const [fabImageDecoded, setFabImageDecoded] = useState(() => !showPhotoFab)

  useLayoutEffect(() => {
    if (!showPhotoFab) {
      setFabImageDecoded(true)
      return
    }
    let cancelled = false
    const probe = new Image()
    const markReady = () => {
      if (!cancelled) setFabImageDecoded(true)
    }

    probe.onload = markReady
    probe.onerror = markReady
    probe.src = fabImageSrc

    if (probe.complete && probe.naturalHeight > 0) {
      markReady()
    } else {
      setFabImageDecoded(false)
    }

    return () => {
      cancelled = true
      probe.onload = null
      probe.onerror = null
    }
  }, [showPhotoFab, fabImageSrc])

  return {
    fabImageDecoded,
    onFabPhotoLoad: () => setFabImageDecoded(true),
    onFabPhotoError: () => setFabImageDecoded(true),
  }
}
