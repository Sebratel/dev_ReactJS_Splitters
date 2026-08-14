/**
 * O `leaflet.heat` é carregado por import dinâmico só pelo efeito secundário — regista-se no
 * `L` global e não exporta nada de útil (ver `ensureLeafletHeat` nos mapas). Sem esta
 * declaração o `tsc` acusa TS7016 ("implicitly has an 'any' type") no caminho do ficheiro.
 *
 * Os tipos do que o plugin acrescenta ao `L` estão em `leaflet-heat.d.ts`.
 */
declare module 'leaflet.heat/dist/leaflet-heat.js' {
  const plugin: unknown
  export default plugin
}
