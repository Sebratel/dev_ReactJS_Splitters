import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudConfirmDialog } from '@/features/gmud/ui/GmudConfirmDialog'
import { gmudConfirm, type GmudConfirmOptions, type GmudConfirmResult } from '@/features/gmud/lib/gmudConfirm'

const CANCELAR_GMUD: GmudConfirmOptions = {
  titulo: 'Cancelar esta GMUD?',
  mensagem: 'CANCELAR esta GMUD vai CANCELAR o protocolo 1890029 no Elleven.',
  confirmar: 'Cancelar GMUD',
  cancelar: 'Voltar',
  tom: 'destrutivo',
  campoTexto: { rotulo: 'Relato (opcional)', ajuda: 'Vai junto no protocolo. Pode deixar em branco.' },
}

/** Tela mínima: um botão abre o diálogo e o resultado aparece para o teste conferir. */
function Tela({ options, onResult }: { options: GmudConfirmOptions; onResult: (r: GmudConfirmResult) => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir
      </button>
      {aberto ? (
        <GmudConfirmDialog
          options={options}
          onResolve={(r) => {
            setAberto(false)
            onResult(r)
          }}
        />
      ) : null}
    </>
  )
}

async function abrir(options: GmudConfirmOptions) {
  const onResult = vi.fn()
  render(<Tela options={options} onResult={onResult} />)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  return onResult
}

describe('GmudConfirmDialog', () => {
  it('abre no meio da tela com a pergunta, a mensagem e os dois botões', async () => {
    await abrir(CANCELAR_GMUD)
    const dialogo = screen.getByRole('alertdialog', { name: 'Cancelar esta GMUD?' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveAccessibleDescription('CANCELAR esta GMUD vai CANCELAR o protocolo 1890029 no Elleven.')
    expect(within(dialogo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Voltar', 'Cancelar GMUD'])
    expect(within(dialogo).queryByText('OK')).toBeNull()
  })

  it('com campo de texto: o foco começa nele e o texto vai junto ao confirmar', async () => {
    const onResult = await abrir(CANCELAR_GMUD)
    const campo = screen.getByLabelText('Relato (opcional)')
    expect(campo).toHaveFocus()
    expect(campo).toHaveAccessibleDescription('Vai junto no protocolo. Pode deixar em branco.')
    await userEvent.type(campo, 'Janela adiada pelo cliente')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar GMUD' }))
    expect(onResult).toHaveBeenCalledWith({ confirmado: true, texto: 'Janela adiada pelo cliente' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('relato em branco confirma com texto vazio; Enter no campo não confirma', async () => {
    const onResult = await abrir(CANCELAR_GMUD)
    await userEvent.keyboard('{Enter}')
    expect(onResult).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar GMUD' }))
    expect(onResult).toHaveBeenCalledWith({ confirmado: true, texto: '\n' })
  })

  it('desistir pelo botão, pelo Esc ou pelo fundo nunca confirma (e descarta o texto)', async () => {
    const onResult = await abrir(CANCELAR_GMUD)
    await userEvent.type(screen.getByLabelText('Relato (opcional)'), 'rascunho')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(onResult).toHaveBeenLastCalledWith({ confirmado: false, texto: '' })
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.keyboard('{Escape}')
    expect(onResult).toHaveBeenLastCalledWith({ confirmado: false, texto: '' })
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const fundo = screen.getByRole('alertdialog').previousElementSibling as HTMLElement
    await userEvent.click(fundo)
    expect(onResult).toHaveBeenLastCalledWith({ confirmado: false, texto: '' })
    expect(onResult).toHaveBeenCalledTimes(3)
  })

  it('destrutivo sem campo: o foco começa no botão seguro e o confirmar é vermelho', async () => {
    await abrir({ titulo: 'Remover este anexo?', mensagem: 'Esta ação não pode ser desfeita.', confirmar: 'Remover', cancelar: 'Manter', tom: 'destrutivo' })
    expect(screen.getByRole('button', { name: 'Manter' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Remover' })).toHaveClass('bg-red-700')
  })

  it('neutro sem campo: o foco começa no botão que confirma; desistir padrão é "Voltar"', async () => {
    const onResult = await abrir({ titulo: 'Aprovar em nome da área "T&TI/COR"?', mensagem: 'Isso fica registrado na linha do tempo.', confirmar: 'Aprovar' })
    expect(screen.getByRole('button', { name: 'Aprovar' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(onResult).toHaveBeenCalledWith({ confirmado: true, texto: '' })
  })

  it('o foco fica preso no diálogo e volta para onde estava ao fechar', async () => {
    await abrir(CANCELAR_GMUD)
    const campo = screen.getByLabelText('Relato (opcional)')
    const voltar = screen.getByRole('button', { name: 'Voltar' })
    const confirmar = screen.getByRole('button', { name: 'Cancelar GMUD' })
    expect(campo).toHaveFocus()
    await userEvent.tab()
    expect(voltar).toHaveFocus()
    await userEvent.tab()
    expect(confirmar).toHaveFocus()
    await userEvent.tab()
    expect(campo).toHaveFocus() // deu a volta, sem sair para o botão "Abrir"
    await userEvent.tab({ shift: true })
    expect(confirmar).toHaveFocus()

    await userEvent.click(voltar)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('sem mensagem, só o título (ex.: remover o fluxograma)', async () => {
    await abrir({ titulo: 'Remover o fluxograma desta GMUD?', confirmar: 'Remover', cancelar: 'Manter', tom: 'destrutivo' })
    expect(screen.getByRole('alertdialog', { name: 'Remover o fluxograma desta GMUD?' })).not.toHaveAttribute('aria-describedby')
  })

  it('o Esc fecha só este diálogo, não um modal aberto por baixo', async () => {
    const fecharModalDeBaixo = vi.fn()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharModalDeBaixo()
    }
    window.addEventListener('keydown', onKey)
    try {
      await abrir({ titulo: 'Negar esta GMUD?', confirmar: 'Negar GMUD', tom: 'destrutivo' })
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(fecharModalDeBaixo).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', onKey)
    }
  })
})

describe('gmudConfirm (uso com await)', () => {
  afterEach(() => {
    document.querySelectorAll('[data-gmud-confirm]').forEach((el) => el.remove())
  })

  it('resolve com confirmado e o texto ao confirmar, e limpa o que criou na página', async () => {
    let promessa: Promise<GmudConfirmResult> = Promise.resolve({ confirmado: false, texto: '' })
    act(() => {
      promessa = gmudConfirm(CANCELAR_GMUD)
    })
    const campo = await screen.findByLabelText('Relato (opcional)')
    await userEvent.type(campo, 'feito')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar GMUD' }))
    await expect(promessa).resolves.toEqual({ confirmado: true, texto: 'feito' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.querySelector('[data-gmud-confirm]')).toBeNull()
  })

  it('resolve com confirmado=false ao desistir (nunca rejeita)', async () => {
    let promessa: Promise<GmudConfirmResult> = Promise.resolve({ confirmado: true, texto: '' })
    act(() => {
      promessa = gmudConfirm({ titulo: 'Remover este anexo?', confirmar: 'Remover', cancelar: 'Manter', tom: 'destrutivo' })
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Manter' }))
    await expect(promessa).resolves.toEqual({ confirmado: false, texto: '' })
    expect(document.querySelector('[data-gmud-confirm]')).toBeNull()
  })
})
