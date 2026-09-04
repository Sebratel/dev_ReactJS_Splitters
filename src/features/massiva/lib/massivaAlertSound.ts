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

type Tone = { freq: number; start: number; duration: number; type?: OscillatorType }

/**
 * Toca uma sequência de tons. Onda quadrada por padrão (som de alarme, bem mais
 * perceptível que a senoide). `gainPeak` alto = mais chamativo.
 */
function playTones(tones: Tone[], gainPeak = 0.32): void {
  const ctx = getCtx()
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const t of tones) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = t.type ?? 'square'
    osc.frequency.value = t.freq
    const s = now + t.start
    const e = s + t.duration
    gain.gain.setValueAtTime(0.0001, s)
    gain.gain.linearRampToValueAtTime(gainPeak, s + 0.008)
    gain.gain.setValueAtTime(gainPeak, e - 0.03)
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
    case 'new': // arpejo ascendente forte — evento novo
      playTones(
        [
          { freq: 523, start: 0, duration: 0.13 },
          { freq: 659, start: 0.14, duration: 0.13 },
          { freq: 880, start: 0.28, duration: 0.26 },
        ],
        0.3,
      )
      break
    case 'near': // beeps duplos repetidos — atenção
      playTones(
        [
          { freq: 784, start: 0, duration: 0.13 },
          { freq: 784, start: 0.17, duration: 0.13 },
          { freq: 784, start: 0.45, duration: 0.13 },
          { freq: 784, start: 0.62, duration: 0.16 },
        ],
        0.32,
      )
      break
    case 'expired': // sirene alternando grave/agudo — urgente
      playTones(
        [
          { freq: 900, start: 0, duration: 0.16 },
          { freq: 620, start: 0.18, duration: 0.16 },
          { freq: 900, start: 0.36, duration: 0.16 },
          { freq: 620, start: 0.54, duration: 0.16 },
          { freq: 900, start: 0.72, duration: 0.16 },
          { freq: 620, start: 0.9, duration: 0.28 },
        ],
        0.38,
      )
      break
    case 'test': // confirmação ao ligar
      playTones([{ freq: 880, start: 0, duration: 0.16 }], 0.3)
      break
  }
}
