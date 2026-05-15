import {
  isExpectedMassivaCatalogTitle,
  isMassivaCatalogOutOfBand,
  normalizeMassivaCatalogTitle,
} from '@/features/massiva/lib/massivaCatalogTitle'

describe('massivaCatalogTitle', () => {
  it('normalizes spaces and case', () => {
    expect(normalizeMassivaCatalogTitle('  Registro  Evento Massivo  ')).toBe(
      'registro evento massivo',
    )
  })

  it('matches expected catalog titles', () => {
    expect(isExpectedMassivaCatalogTitle('Registro Evento Massivo')).toBe(true)
    expect(isExpectedMassivaCatalogTitle('registro incidente de rede')).toBe(true)
    expect(isExpectedMassivaCatalogTitle('Registro Incidente de Rede')).toBe(true)
  })

  it('rejects other titles', () => {
    expect(isExpectedMassivaCatalogTitle('Registro Incidente Massivo')).toBe(false)
    expect(isMassivaCatalogOutOfBand('Outro tipo')).toBe(true)
    expect(isMassivaCatalogOutOfBand('')).toBe(true)
  })
})
