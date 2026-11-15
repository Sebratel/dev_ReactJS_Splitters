import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { atualizadoHa } from '@/features/gmud/lib/gmudAtualizado'
import { cn } from '@/shared/lib/utils'

// Botões separados, todos com 40 px de altura, cantos de 8 px, contorno nítido e fundo do cartão.
// O foco é um anel no amarelo da marca, afastado do botão para aparecer sobre o fundo claro.
const BOTAO =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-surface-container-lowest text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest dark:border-white/25'
/** Em tela estreita o rótulo some e o botão vira um quadrado de 40 px (o nome fica no aria-label e no title). */
const COM_ROTULO = 'w-10 sm:w-auto sm:px-3'
const ROTULO = 'hidden sm:inline'

/**
 * Ações do cabeçalho do painel de GMUDs, em botões separados: "Atualizar" (só ícone, com o "Atualizado há X"
 * ao lado), "Indicadores" e "Configurar" (ícone + texto) e, por último, "Nova GMUD" — o único em amarelo.
 * O botão "Voltar" do cabeçalho não é daqui (continua vindo do AppPageHeader).
 */
export function GmudHeaderActions({ canConfigure }: { canConfigure: boolean }) {
  const queryClient = useQueryClient()
  const buscando = useIsFetching({ queryKey: ['gmud'] }) > 0
  // Para o leitor de tela: só anuncia depois que a pessoa pediu para atualizar.
  const [pediu, setPediu] = useState(false)
  // Relógio do "Atualizado há X": anda de minuto em minuto.
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // A atualização mais recente entre as consultas do módulo (lista, cartões, agenda, reunião semanal…).
  const atualizadoEm = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['gmud'] })
    .reduce((max, q) => Math.max(max, q.state.dataUpdatedAt), 0)
  const ha = atualizadoHa(atualizadoEm, Math.max(agora, atualizadoEm))

  const atualizar = () => {
    setPediu(true)
    // Todo o módulo: lista, contagens, cartões do topo, agenda e reunião semanal.
    void queryClient.invalidateQueries({ queryKey: ['gmud'] })
  }

  return (
    <div role="group" aria-label="Ações do painel de GMUDs" className="flex min-w-0 flex-wrap items-center gap-2">
      <button type="button" onClick={atualizar} aria-label="Atualizar" title="Atualizar" className={cn(BOTAO, 'w-10')}>
        <RefreshCw size={18} aria-hidden className={cn('shrink-0', buscando ? 'animate-spin motion-reduce:animate-none' : '')} />
      </button>
      {ha !== '' ? (
        <p className="hidden text-xs text-on-surface-variant md:block" title={new Date(atualizadoEm).toLocaleString('pt-BR')}>
          Atualizado {ha}
        </p>
      ) : null}
      <span role="status" className="sr-only">
        {buscando ? (pediu ? 'Atualizando…' : '') : pediu ? 'Atualizado' : ''}
      </span>

      <Link to="/gmud/indicadores" aria-label="Indicadores" title="Indicadores das GMUDs" className={cn(BOTAO, COM_ROTULO)}>
        <BarChart3 size={18} aria-hidden className="shrink-0" />
        <span className={ROTULO}>Indicadores</span>
      </Link>
      {canConfigure ? (
        <Link to="/gmud/configuracoes" aria-label="Configurar" title="Configurações do módulo GMUD" className={cn(BOTAO, COM_ROTULO)}>
          <Settings2 size={18} aria-hidden className="shrink-0" />
          <span className={ROTULO}>Configurar</span>
        </Link>
      ) : null}

      {/* Único botão amarelo entre as ações da GMUD, e o último delas (fica à esquerda do Voltar). */}
      <Link
        to="/gmud/nova"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-neutral-900 shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest dark:focus-visible:ring-white"
      >
        <Plus size={18} aria-hidden className="shrink-0" /> Nova GMUD
      </Link>
    </div>
  )
}
