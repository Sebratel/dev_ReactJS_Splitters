import { AlertTriangle, ExternalLink } from 'lucide-react'

/** Condições para exibir o alerta de divergência. */
export type GmudEllevenAlertProps = {
  /** Status do Comitê: a GMUD precisa estar aprovada para o alerta fazer sentido. */
  statusComite: string | null | undefined
  /** Data de fim da janela de execução (YYYY-MM-DD). Usa dataInicio como fallback. */
  dataFim: string | null | undefined
  /** Se preenchido, o protocolo já foi encerrado no Elleven — alerta não exibe. */
  ellevenEncerradoEm: string | null | undefined
  /** Se preenchido, o protocolo foi encerrado no Voalle — alerta não exibe. */
  conclusionDate: string | null | undefined
}

function todayKey(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/**
 * Alerta de divergência entre status local e Elleven:
 * aparece quando a janela de execução já passou, o Comitê aprovou,
 * mas o protocolo ainda não foi encerrado por esta plataforma.
 */
export function GmudEllevenStatusAlert({
  statusComite,
  dataFim,
  ellevenEncerradoEm,
  conclusionDate,
}: GmudEllevenAlertProps) {
  // Não exibe se já encerrado, negado, ou sem data de execução
  if (ellevenEncerradoEm || conclusionDate) return null
  if (statusComite !== 'aprovada') return null
  if (!dataFim) return null

  const today = todayKey()
  if (dataFim >= today) return null // janela ainda não passou

  const [y, m, d] = dataFim.split('-')
  const dataFimFmt = d && m && y ? `${d}/${m}/${y}` : dataFim

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/30">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-200">
          Janela encerrada — protocolo ainda aberto no Elleven
        </p>
        <p className="text-amber-800/80 dark:text-amber-300/80">
          A janela de execução terminou em <strong>{dataFimFmt}</strong> mas o protocolo ainda não foi encerrado
          por esta plataforma. Use o botão <strong>Concluir GMUD</strong> (se a mudança foi bem-sucedida)
          ou <strong>Cancelar GMUD</strong> para registrar o encerramento.
        </p>
        <p className="flex items-center gap-1 text-xs text-amber-700/70 dark:text-amber-400/60">
          <ExternalLink size={11} />
          Se o protocolo já foi encerrado manualmente no Elleven, use "Concluir GMUD" para sincronizar o status aqui.
        </p>
      </div>
    </div>
  )
}
