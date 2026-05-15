import type { GeogridReservaRow } from '@/features/splitters/model/geogridReservaRow'
import { formatBrazilDateTimeDisplay } from '@/shared/lib/formatBrazilDisplayDate'

type SplitterGeoGridPanelProps = {
  rows: GeogridReservaRow[]
}

function formatReservaLabel(row: GeogridReservaRow): string {
  if (row.hasReservaComCadeado) return 'Reserva (cadeado)'
  if (row.hasReserva && row.reservaEmAtendimento) return 'Reserva em atendimento'
  if (row.hasReserva) return 'Reserva'
  return 'Sem reserva'
}

function formatData(iso: string | null): string {
  if (!iso) return '-'
  return formatBrazilDateTimeDisplay(iso, {
    dateStyle: 'short',
    timeStyle: 'short',
    fallback: iso,
  })
}

/**
 * Lista de portas GeoGrid (sem mapa nem vizinhos).
 */
export function SplitterGeoGridPanel({ rows }: SplitterGeoGridPanelProps) {
  return (
    <section
      className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
      aria-labelledby="splitter-geogrid-heading"
    >
      <h2
        id="splitter-geogrid-heading"
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
      >
        GeoGrid - portas e reservas
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Dados da API GeoGrid para este splitter (`integrationCode`). Nomes de cliente aparecem quando a
        reserva está com cadeado, como no app Flutter.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
              <th className="py-2 pr-3 font-medium">Porta</th>
              <th className="py-2 pr-3 font-medium">Situação</th>
              <th className="py-2 pr-3 font-medium">Cliente</th>
              <th className="py-2 font-medium">Data reserva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.porta}
                className="border-b border-neutral-100 dark:border-neutral-800"
              >
                <td className="py-2 pr-3 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {row.porta}
                </td>
                <td className="py-2 pr-3 text-neutral-800 dark:text-neutral-200">
                  {formatReservaLabel(row)}
                </td>
                <td className="py-2 pr-3 text-neutral-800 dark:text-neutral-200">
                  {row.clienteNome ?? (row.idCliente ? `ID ${row.idCliente}` : '-')}
                </td>
                <td className="py-2 text-neutral-600 dark:text-neutral-400">
                  {formatData(row.dataReserva)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

