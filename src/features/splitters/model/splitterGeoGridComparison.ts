export type SplitterGeoGridComparisonStatus =
  | 'match'
  | 'port-mismatch'
  | 'no-attendance'
  | 'not-found'
  | 'ambiguous'

export type SplitterGeoGridComparisonRow = {
  clientId: number
  authenticationId: number
  name: string
  pppoe: string
  splitterPort: number | null
  geogridPort: number | null
  geogridEquipmentSigla: string | null
  geogridClientId: string | null
  oltSigla: string | null
  status: SplitterGeoGridComparisonStatus
  note: string
}
