import { useLayoutEffect, useState } from 'react'

/**
 * Controla quando o chrome do FAB (foto ISA) pode aparecer.
 * Imagens em cache costumam não disparar `onLoad` ao remontar — um `Image()` em `useLayoutEffect`
 * deteta `complete` antes da pintura e evita FAB “invisível” ao voltar de outra rota.
 */
export function useFabPhotoDecodedGate(showPhotoFab: boolean, fabImageSrc: string) {
  const [fabImageDecoded, setFabImageDecoded] = useState(() => !showPhotoFab)

  useLayoutEffect(() => {
    if (!showPhotoFab) {
      setFabImageDecoded(true)
      return
    }
    const probe = new Image()
    probe.src = fabImageSrc
    if (probe.complete && probe.naturalHeight > 0) {
      setFabImageDecoded(true)
    } else {
      setFabImageDecoded(false)
    }
  }, [showPhotoFab, fabImageSrc])

  return {
    fabImageDecoded,
    onFabPhotoLoad: () => setFabImageDecoded(true),
    onFabPhotoError: () => setFabImageDecoded(true),
  }
}
