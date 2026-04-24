import type { GeogridPortaWithDerived } from '@/features/splitters/model/geogridPorta'

/**
 * Linha pronta para UI: porta GeoGrid + nome do cliente quando a reserva está “com cadeado”.
 */
export type GeogridReservaRow = GeogridPortaWithDerived & {
  clienteNome: string | null
}
