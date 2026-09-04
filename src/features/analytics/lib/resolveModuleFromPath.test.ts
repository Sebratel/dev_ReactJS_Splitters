import { describe, expect, it } from 'vitest'
import { resolveModuleFromPath } from './resolveModuleFromPath'

describe('resolveModuleFromPath', () => {
  it('mapeia as rotas de topo para seus módulos', () => {
    expect(resolveModuleFromPath('/')).toBe('dashboard')
    expect(resolveModuleFromPath('/splitters')).toBe('splitters')
    expect(resolveModuleFromPath('/intelligence')).toBe('intelligence')
    expect(resolveModuleFromPath('/redistribuicao-condominios')).toBe('redistribuicao')
    expect(resolveModuleFromPath('/sugestoes')).toBe('sugestoes')
    expect(resolveModuleFromPath('/usuarios')).toBe('usuarios')
    expect(resolveModuleFromPath('/isa-config')).toBe('isa-config')
  })

  it('distingue detalhe de listagem por prefixo', () => {
    expect(resolveModuleFromPath('/splitters/ABC123')).toBe('splitter-detail')
    expect(resolveModuleFromPath('/clientes/42')).toBe('cliente-detail')
  })

  it('separa as sub-rotas de massiva', () => {
    expect(resolveModuleFromPath('/massiva')).toBe('massiva')
    expect(resolveModuleFromPath('/massiva/dashboard')).toBe('massiva-dashboard')
    expect(resolveModuleFromPath('/massiva/monitor')).toBe('massiva-monitor')
  })

  it('ignora barra final e cai em "outros" para rotas desconhecidas', () => {
    expect(resolveModuleFromPath('/splitters/')).toBe('splitters')
    expect(resolveModuleFromPath('/rota-inexistente')).toBe('outros')
    expect(resolveModuleFromPath('')).toBe('dashboard')
  })
})
