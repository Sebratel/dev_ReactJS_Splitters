/**
 * Preenche `street` em vizinhos via reverse geocode, com limite e pausa (política Nominatim).
 * O GET `/api/splitters/neighbors-routed` não aguarda mais esta função (mapa enriquece no browser);
 * mantida para reutilização (ex.: jobs) ou chamadas futuras.
 */

import { fetchRoadFromReverseGeocode, isReverseGeocodeDisabled } from './reverseGeocode.js';

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * @param {Array<{
 *   code: string
 *   title: string
 *   street: string
 *   outPorts: number
 *   busyCount: number
 *   lat: number
 *   lng: number
 *   straightMeters: number
 *   routeMeters: number | null
 *   isCondominium: boolean
 * }>} rows — muta `street` quando encontrar via.
 * @param {{ routingUnavailable?: boolean; pauseAfterOriginMs?: number }} ctx
 *   pauseAfterOriginMs — pausa antes do 1.º vizinho quando já houve reverse geocode na origem (evita 429 Nominatim).
 */
export async function enrichNeighborStreetsForMap(rows, ctx = {}) {
  if (isReverseGeocodeDisabled()) return;

  const pauseAfterOriginMs = Math.max(0, Math.trunc(Number(ctx.pauseAfterOriginMs ?? 0) || 0));

  const max = Math.min(parsePositiveInt(process.env.REVERSE_GEOCODE_NEIGHBORS_MAX, 4), 12);
  const delayMs = parsePositiveInt(process.env.REVERSE_GEOCODE_NEIGHBORS_DELAY_MS, 1100);
  if (max === 0 || !Array.isArray(rows) || rows.length === 0) return;

  const routingUnavailable = Boolean(ctx.routingUnavailable);

  const empty = rows.filter(
    (n) =>
      String(n.street ?? '').trim() === '' &&
      Number.isFinite(n.lat) &&
      Number.isFinite(n.lng),
  );
  if (empty.length === 0) return;

  if (pauseAfterOriginMs > 0) {
    await new Promise((r) => {
      setTimeout(r, pauseAfterOriginMs);
    });
  }

  const routeDist = (n) => {
    if (!routingUnavailable && n.routeMeters != null && Number.isFinite(n.routeMeters)) {
      return n.routeMeters;
    }
    return n.straightMeters ?? 1e9;
  };

  const hasFreePort = (n) => n.outPorts > 0 && n.busyCount < n.outPorts;

  /** 0 = melhor: rua, com porta livre; 1 = rua sem porta livre; 2 = condomínio */
  const tier = (n) => {
    if (n.isCondominium) return 2;
    return hasFreePort(n) ? 0 : 1;
  };

  const sorted = [...empty].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    return routeDist(a) - routeDist(b);
  });

  const toProcess = sorted.slice(0, max);

  for (let i = 0; i < toProcess.length; i += 1) {
    const n = toProcess[i];
    const road = await fetchRoadFromReverseGeocode(n.lat, n.lng);
    if (road && road.trim() !== '') {
      n.street = road.trim();
    }
    if (i < toProcess.length - 1 && delayMs > 0) {
      await new Promise((r) => {
        setTimeout(r, delayMs);
      });
    }
  }
}
