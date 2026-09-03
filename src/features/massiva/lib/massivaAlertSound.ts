/**
 * Alertas sonoros de massiva sintetizados via Web Audio — sem arquivos de áudio.
 * O navegador bloqueia áudio até um gesto do usuário: chame `primeMassivaAudio()`
 * dentro de um clique (ex.: ao ligar os alertas) para liberar o contexto.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtx) return audioCtx
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    audioCtx = new AC()
  } catch {
    audioCtx = null
  }
  return audioCtx
}

/** Libera o áudio — precisa rodar dentro de um gesto do usuário (clique). */
export async function primeMassivaAudio(): Promise<void> {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // ignora — sem áudio
    }
  }
}

type Tone = { freq: number; start: number; duration: number }

function playTones(tones: Tone[], gainPeak = 0.18): void {
  const ctx = getCtx()
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const t of tones) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = t.freq
    const s = now + t.start
    const e = s + t.duration
    gain.gain.setValueAtTime(0.0001, s)
    gain.gain.linearRampToValueAtTime(gainPeak, s + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, e)
    osc.connect(gain).connect(ctx.destination)
    osc.start(s)
    osc.stop(e + 0.02)
  }
}

export type MassivaAlertKind = 'new' | 'near' | 'expired' | 'test'

/** Toca o som correspondente ao tipo de alerta (no-op se o áudio não estiver liberado). */
export function playMassivaAlert(kind: MassivaAlertKind): void {
  switch (kind) {
    case 'new': // duas notas ascendentes — evento novo
      playTones([
        { freq: 660, start: 0, duration: 0.14 },
        { freq: 990, start: 0.15, duration: 0.2 },
      ])
      break
    case 'near': // um beep médio — atenção
      playTones([{ freq: 560, start: 0, duration: 0.2 }])
      break
    case 'expired': // três beeps descendentes — urgente
      playTones(
        [
          { freq: 500, start: 0, duration: 0.13 },
          { freq: 500, start: 0.17, duration: 0.13 },
          { freq: 400, start: 0.34, duration: 0.26 },
        ],
        0.22,
      )
      break
    case 'test': // confirmação ao ligar
      playTones([{ freq: 880, start: 0, duration: 0.12 }])
      break
  }
}
