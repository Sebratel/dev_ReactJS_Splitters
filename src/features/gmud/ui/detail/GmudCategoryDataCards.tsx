import { Monitor, Server } from 'lucide-react'
import type { GmudSistemasExternosData, GmudSistemasInternosData } from '@/features/gmud/model/gmudForm'
import { CardTitle } from '@/features/gmud/ui/detail/GmudDetailCards'
import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cn } from '@/shared/lib/utils'

function Field({ label, value }: { label: string; value: string | string[] | null | undefined }) {
  const raw = Array.isArray(value) ? value.filter(Boolean).join(', ') : (value ?? '').toString().trim()
  if (!raw) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</p>
      <p className="text-sm text-on-surface whitespace-pre-wrap">{raw}</p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-primary/70">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function GmudSistemasInternosCard({ data }: { data: GmudSistemasInternosData }) {
  return (
    <section className={cn(DETAIL_CARD, 'space-y-5 p-4')}>
      <CardTitle icon={<Monitor size={16} />}>Dados do Sistema Interno</CardTitle>

      <Group title="Identificação">
        <Field label="Sistema afetado" value={data.sistemaAfetado || data.sistemaAfetadoOutro} />
        <Field label="Módulo / Funcionalidade" value={data.moduloFuncionalidade} />
        <Field label="Ambiente" value={data.ambiente} />
        <Field label="Natureza da mudança" value={data.natureza} />
        <Field label="Responsável técnico" value={data.responsavelTecnico} />
        <Field label="Equipe responsável" value={data.equipeResponsavel} />
      </Group>

      <Group title="Descrição">
        <Field label="Objetivo" value={data.objetivo} />
        <Field label="Justificativa" value={data.justificativa} />
        <Field label="Resultado esperado" value={data.resultadoEsperado} />
      </Group>

      <Group title="Impacto operacional">
        <Field label="Áreas impactadas" value={data.areasImpactadas} />
        <Field label="Processos de negócio" value={data.processosNegocio} />
        <Field label="Usuários impactados" value={data.usuariosImpactados} />
        <Field label="Haverá indisponibilidade?" value={data.haraIndisponibilidade} />
        <Field label="Tipo de indisponibilidade" value={data.tipoIndisponibilidade} />
        <Field label="Duração estimada" value={data.duracaoEstimada} />
        <Field label="Impacto esperado" value={data.impactoEsperado} />
      </Group>

      <Group title="Dependências">
        <Field label="APIs envolvidas" value={data.apisEnvolvidas} />
        <Field label="Integrações" value={data.integracoes} />
        <Field label="Automações N8N" value={data.automacoesN8n} />
        <Field label="Banco de dados" value={data.bancoDados} />
        <Field label="Serviços dependentes" value={data.servicosDependentes} />
        <Field label="Pré-requisitos" value={data.prerequisitos} />
      </Group>

      <Group title="Validação">
        <Field label="Testes necessários" value={data.testesNecessarios} />
        <Field label="Critérios de sucesso" value={data.criteriosSucesso} />
        <Field label="Responsável pela homologação" value={data.responsavelHomologacao} />
        <Field label="Procedimento de validação" value={data.procedimentoValidacao} />
      </Group>

      <Group title="Comunicação">
        <Field label="Equipes informadas" value={data.equipesInformadas} />
        <Field label="Comunicação prévia" value={data.comunicacaoPrevia} />
        <Field label="Observações adicionais" value={data.observacoesAdicionais} />
      </Group>
    </section>
  )
}

export function GmudSistemasExternosCard({ data }: { data: GmudSistemasExternosData }) {
  return (
    <section className={cn(DETAIL_CARD, 'space-y-5 p-4')}>
      <CardTitle icon={<Server size={16} />}>Dados do Sistema Externo</CardTitle>

      <Group title="Identificação">
        <Field label="Sistema externo" value={data.sistemaExterno || data.sistemaExternoOutro} />
        <Field label="Fornecedor" value={data.fornecedor} />
        <Field label="Serviço / Funcionalidade" value={data.servicoFuncionalidade} />
        <Field label="Ambiente" value={data.ambienteSE} />
        <Field label="Natureza da mudança" value={data.natureza} />
        <Field label="Responsável interno" value={data.responsavelInterno} />
      </Group>

      <Group title="Descrição">
        <Field label="Mudança prevista" value={data.mudancaPrevista} />
        <Field label="Motivo da alteração" value={data.motivoAlteracao} />
        <Field label="Origem da solicitação" value={data.origemSolicitacao} />
        <Field label="Comunicado do fornecedor" value={data.comunicadoFornecedor} />
      </Group>

      <Group title="Impacto operacional">
        <Field label="Áreas afetadas" value={data.areasAfetadas} />
        <Field label="Processos dependentes" value={data.processosDependentes} />
        <Field label="Integrações afetadas" value={data.integracoesAfetadas} />
        <Field label="Haverá indisponibilidade?" value={data.haIndisponibilidade} />
        <Field label="Tipo de indisponibilidade" value={data.tipoIndisponibilidade} />
        <Field label="Duração estimada" value={data.duracaoEstimada} />
        <Field label="Impacto esperado" value={data.impactoEsperado} />
      </Group>

      <Group title="Fornecedor">
        {data.chamadoFornecedor ? <Field label="Chamado no fornecedor" value={data.chamadoFornecedor} /> : null}
        <Field label="Janela do fornecedor" value={data.janelaFornecedor} />
        <Field label="Canal de acompanhamento" value={data.canalAcompanhamento} />
      </Group>

      <Group title="Contingência">
        <Field label="Alternativa operacional" value={data.alternativaOperacional} />
        <Field label="Ações para mitigar" value={data.acoesMitigar} />
        <Field label="Procedimento de recuperação" value={data.procedimentoRecuperacao} />
      </Group>

      <Group title="Validação">
        <Field label="Testes pós-mudança" value={data.testesPosMudanca} />
        <Field label="Validação de integrações" value={data.validacaoIntegracoes} />
        <Field label="Critérios de normalização" value={data.criteriosNormalizacao} />
        <Field label="Responsável pela validação" value={data.responsavelValidacao} />
      </Group>

      <Group title="Comunicação">
        <Field label="Áreas a notificar" value={data.areasNotificar} />
        <Field label="Aviso aos usuários" value={data.avisoUsuarios} />
        <Field label="Observações adicionais" value={data.observacoesAdicionais} />
      </Group>
    </section>
  )
}
