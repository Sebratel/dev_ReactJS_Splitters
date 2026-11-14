import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudJanelaField } from '@/features/gmud/ui/GmudJanelaField'
import type { GmudJanela } from '@/features/gmud/lib/gmudJanela'
import type { GmudRepeticao } from '@/features/gmud/lib/gmudRecurrence'

const VAZIA: GmudJanela = { dataInicio: '', horaInicio: '', dataFim: '', horaFim: '' }

/** O campo é controlado: este envoltório faz o papel do formulário e mostra o estado para o teste conferir. */
function Formulario({ inicial = VAZIA, minInicio, tipo, repeticao }: { inicial?: GmudJanela; minInicio?: string; tipo?: string; repeticao?: GmudRepeticao | null }) {
  const [janela, setJanela] = useState(inicial)
  return (
    <>
      <GmudJanelaField janela={janela} onChange={(patch) => setJanela((j) => ({ ...j, ...patch }))} minInicio={minInicio} tipo={tipo} repeticao={repeticao} />
      <output data-testid="estado">{JSON.stringify(janela)}</output>
    </>
  )
}
const estado = (): GmudJanela => JSON.parse(screen.getByTestId('estado').textContent ?? '{}') as GmudJanela
const campo = (nome: string) => screen.getByLabelText(nome)
const digitar = (nome: string, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })

describe('GmudJanelaField: limpar datas', () => {
  const PREENCHIDA: GmudJanela = { dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' }

  it('não aparece com a janela vazia', () => {
    render(<Formulario />)
    expect(screen.queryByRole('button', { name: 'Limpar datas' })).toBeNull()
  })

  it('aparece com algo preenchido, zera os quatro campos e leva o foco à data de início', async () => {
    render(<Formulario inicial={PREENCHIDA} />)
    await userEvent.click(screen.getByRole('button', { name: 'Limpar datas' }))
    expect(estado()).toEqual({ dataInicio: '', horaInicio: '', dataFim: '', horaFim: '' })
    expect(campo('Data início')).toHaveValue('')
    expect(campo('Horário fim')).toHaveValue('')
    // o botão some e o foco não se perde
    expect(screen.queryByRole('button', { name: 'Limpar datas' })).toBeNull()
    await vi.waitFor(() => expect(campo('Data início')).toHaveFocus())
  })

  it('aparece também quando só um campo foi preenchido', () => {
    render(<Formulario inicial={{ ...VAZIA, horaFim: '03:00' }} />)
    expect(screen.getByRole('button', { name: 'Limpar datas' })).toBeInTheDocument()
  })
})

describe('GmudJanelaField', () => {
  it('mostra os dois blocos com data e horário rotulados', () => {
    render(<Formulario />)
    expect(screen.getByRole('group', { name: 'Início *' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Fim (prazo final) *' })).toBeInTheDocument()
    for (const nome of ['Data início', 'Horário início', 'Data fim', 'Horário fim']) {
      expect(campo(nome)).toHaveAttribute('aria-required', 'true')
    }
    expect(campo('Data início')).toHaveAttribute('type', 'date')
    expect(campo('Horário fim')).toHaveAttribute('type', 'time')
  })

  it('aviso da data mínima: "Usar dd/mm" preenche a data de início (e a de fim, que estava vazia)', async () => {
    render(<Formulario minInicio="2026-11-24" tipo="Programada" />)
    expect(screen.getByText(/a partir de/)).toHaveTextContent('Programada: a partir de 24/11/2026 (apresentação na terça + 7 dias).')
    expect(campo('Data início')).toHaveAttribute('min', '2026-11-24')
    await userEvent.click(screen.getByRole('button', { name: 'Usar 24/11 como data de início' }))
    expect(estado()).toEqual({ dataInicio: '2026-11-24', horaInicio: '', dataFim: '2026-11-24', horaFim: '' })
    // Já está na data mínima: o atalho some.
    expect(screen.queryByRole('button', { name: /Usar 24\/11/ })).toBeNull()
  })

  it('sem data mínima (Emergencial) não há aviso nem min', () => {
    render(<Formulario />)
    expect(screen.queryByText(/a partir de/)).toBeNull()
    expect(campo('Data início')).not.toHaveAttribute('min')
  })

  it('chips de duração: desabilitados sem início; depois preenchem o fim e marcam a duração atual', async () => {
    render(<Formulario />)
    const chip = (nome: string) => screen.getByRole('button', { name: nome })
    expect(chip('3 h')).toBeDisabled()
    digitar('Data início', '2026-11-24')
    digitar('Horário início', '22:00')
    expect(chip('3 h')).toBeEnabled()
    await userEvent.click(chip('3 h'))
    expect(estado()).toEqual({ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' })
    expect(chip('3 h')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('1 h')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip('1 h'))
    expect(estado()).toMatchObject({ dataFim: '2026-11-24', horaFim: '23:00' })
    expect(chip('1 h')).toHaveAttribute('aria-pressed', 'true')
  })

  it('resumo vivo com duração e "vira o dia"', () => {
    render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' }} />)
    expect(screen.getByText('Terça 24/11, 22:00 até quarta 25/11, 01:00')).toBeInTheDocument()
    expect(screen.getByText('3 h de duração')).toBeInTheDocument()
    expect(screen.getByText('vira o dia')).toBeInTheDocument()
    expect(screen.getByText('continua no dia seguinte')).toBeInTheDocument()
  })

  it('no mesmo dia não há "vira o dia"; incompleta não mostra resumo', () => {
    const { unmount } = render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '08:00', dataFim: '2026-11-24', horaFim: '11:30' }} />)
    expect(screen.getByText('3 h 30 min de duração')).toBeInTheDocument()
    expect(screen.queryByText('vira o dia')).toBeNull()
    unmount()
    render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '08:00', dataFim: '', horaFim: '' }} />)
    expect(screen.queryByText(/de duração/)).toBeNull()
    expect(screen.queryByText('O fim precisa ser depois do início.')).toBeNull()
  })

  it('horário de fim antes do início no mesmo dia: assume o dia seguinte e avisa no resumo', () => {
    render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-24', horaFim: '' }} />)
    digitar('Horário fim', '01:00')
    expect(estado().dataFim).toBe('2026-11-25')
    expect(screen.getByText('vira o dia')).toBeInTheDocument()
  })

  it('escolher a data de início preenche a de fim vazia, sem sobrescrever uma já escolhida', () => {
    const { unmount } = render(<Formulario />)
    digitar('Data início', '2026-11-24')
    expect(estado().dataFim).toBe('2026-11-24')
    unmount()
    render(<Formulario inicial={{ dataInicio: '2026-11-20', horaInicio: '08:00', dataFim: '2026-11-27', horaFim: '10:00' }} />)
    digitar('Data início', '2026-11-24')
    expect(estado().dataFim).toBe('2026-11-27')
    expect(screen.getByText('3 dias 2 h de duração')).toBeInTheDocument()
  })

  it('fim que não é depois do início: o resumo vira aviso de erro; a pessoa pode voltar a data à mão', () => {
    render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' }} />)
    digitar('Data fim', '2026-11-24')
    expect(estado().dataFim).toBe('2026-11-24')
    expect(screen.getByText('O fim precisa ser depois do início.')).toBeInTheDocument()
    expect(screen.queryByText(/de duração/)).toBeNull()
  })

  it('Pré-aprovada com repetição: prévia das ocorrências com o dia da semana', () => {
    const { unmount } = render(
      <Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' }} repeticao={{ vezes: 3, intervaloDias: 15 }} />,
    )
    expect(screen.getByText('3 ocorrências, com o mesmo horário')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ter 24/11', 'Qua 09/12', 'Qui 24/12'])
    unmount()
    // Uma só ocorrência ou sem data de início: sem prévia.
    render(<Formulario inicial={{ dataInicio: '2026-11-24', horaInicio: '22:00', dataFim: '2026-11-25', horaFim: '01:00' }} repeticao={{ vezes: 1, intervaloDias: 0 }} />)
    expect(screen.queryByText(/ocorrências/)).toBeNull()
  })
})
