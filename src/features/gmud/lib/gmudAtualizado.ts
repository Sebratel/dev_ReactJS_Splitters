/** "agora mesmo", "há 1 min", "há 12 min", "há 2 h". Vazio se ainda não houve nenhuma atualização. */
export function atualizadoHa(atualizadoEm: number, agora: number): string {
  if (!(atualizadoEm > 0)) return ''
  const minutos = Math.floor(Math.max(0, agora - atualizadoEm) / 60_000)
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `há ${minutos} min`
  return `há ${Math.floor(minutos / 60)} h`
}
