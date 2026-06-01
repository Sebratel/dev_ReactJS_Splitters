/**
 * Reverse geocode (Nominatim ou proxy compatível) para obter nome de via a partir de lat/lng.
 * Política OSM: User-Agent identificável — defina REVERSE_GEOCODE_USER_AGENT em produção.
 */

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

/** @type {Map<string, { road: string | null; at: number }>} */
const cache = new Map();
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;
/** Nominatim público: ~1 req/s — fila global no BFF (captura da fila espelha o mapa). */
const DEFAULT_NOMINATIM_MIN_INTERVAL_MS = 1100;

let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();

function usesPublicNominatim() {
  const custom = (
    process.env.REVERSE_GEOCODE_ENDPOINT ||
    process.env.VITE_REVERSE_GEOCODE_ENDPOINT ||
    ''
  ).trim();
  return custom.length === 0;
}

function nominatimMinIntervalMs() {
  const raw = Number.parseInt(String(process.env.REVERSE_GEOCODE_MIN_INTERVAL_MS ?? ''), 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_NOMINATIM_MIN_INTERVAL_MS;
}

/** Serializa chamadas ao Nominatim público para evitar HTTP 429 na captura em massa. */
function scheduleNominatimRequest(task) {
  if (!usesPublicNominatim()) {
    return task();
  }
  const run = nominatimQueue.then(async () => {
    const minGap = nominatimMinIntervalMs();
    const wait = lastNominatimRequestAt + minGap - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, wait);
      });
    }
    lastNominatimRequestAt = Date.now();
    return task();
  });
  nominatimQueue = run.catch(() => {});
  return run;
}

function cacheKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function reverseGeocodeDisabled() {
  return String(process.env.REVERSE_GEOCODE_DISABLED || '').toLowerCase() === 'true';
}

/** Para o handler alinhar pausas (ex.: após geocode na origem). */
export function isReverseGeocodeDisabled() {
  return reverseGeocodeDisabled();
}

function pickRoadFromNominatimAddress(addr) {
  if (!addr || typeof addr !== 'object') return null
  const candidates = [
    addr.road,
    addr.pedestrian,
    addr.residential,
    addr.path,
    addr.footway,
    addr.neighbourhood,
    addr.suburb,
    addr.quarter,
    addr.city_block,
    addr.hamlet,
    addr.village,
  ]
  for (const c of candidates) {
    const s = String(c ?? '').trim()
    if (s !== '') return s
  }
  return null
}

/** Primeiro segmento de display_name (Nominatim) quando address.road vem vazio. */
function pickRoadFromDisplayName(json) {
  const dn = String(json?.display_name ?? '').trim()
  if (dn === '') return null
  const first = dn.split(',')[0]?.trim()
  return first === '' ? null : first
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>} Nome da via (ex.: "Avenida Brasil") ou null.
 */
export async function fetchRoadFromReverseGeocode(lat, lng) {
  if (reverseGeocodeDisabled()) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = cacheKey(lat, lng);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) {
    return hit.road;
  }

  const ua = (process.env.REVERSE_GEOCODE_USER_AGENT || '').trim();
  if (ua === '') {
    // Nominatim exige User-Agent válido; fallback mínimo para dev.
    console.warn(
      '[reverseGeocode] REVERSE_GEOCODE_USER_AGENT não definido; usando identificador genérico (configure em produção).',
    );
  }

  const custom = (
    process.env.REVERSE_GEOCODE_ENDPOINT ||
    process.env.VITE_REVERSE_GEOCODE_ENDPOINT ||
    ''
  ).trim();
  let url;
  if (custom.length > 0) {
    const u = new URL(custom);
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lng', String(lng));
    u.searchParams.set('lon', String(lng));
    url = u.toString();
  } else {
    const u = new URL(NOMINATIM_REVERSE);
    u.searchParams.set('format', 'json');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lng));
    u.searchParams.set('addressdetails', '1');
    u.searchParams.set('zoom', '18');
    u.searchParams.set('accept-language', 'pt-BR,pt,en');
    url = u.toString();
  }

  const timeoutMs = Number.parseInt(String(process.env.REVERSE_GEOCODE_TIMEOUT_MS ?? ''), 10);
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  async function fetchOnce() {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            ua || 'Sebratel-Splitters-BFF/1.0 (set REVERSE_GEOCODE_USER_AGENT; contact@example.invalid)',
          Accept: 'application/json',
        },
      });
    } finally {
      clearTimeout(t);
    }
  }

  async function readRoadFromResponse(res) {
    if (!res.ok) return { road: null, status: res.status };
    const json = await res.json();
    const fromAddr = pickRoadFromNominatimAddress(json?.address);
    const road =
      (fromAddr && fromAddr.trim() !== '' ? fromAddr : pickRoadFromDisplayName(json))?.trim() || null;
    return { road, status: res.status };
  }

  try {
    let res = await scheduleNominatimRequest(fetchOnce);
    if (res.status === 429 && usesPublicNominatim()) {
      const retryAfterSec = Number.parseInt(String(res.headers.get('retry-after') ?? '2'), 10);
      const backoffMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 2500;
      console.warn('[reverseGeocode] HTTP 429 — nova tentativa após pausa', { backoffMs });
      await new Promise((resolve) => {
        setTimeout(resolve, backoffMs);
      });
      lastNominatimRequestAt = Date.now();
      res = await scheduleNominatimRequest(fetchOnce);
    }
    if (!res.ok) {
      console.warn('[reverseGeocode] HTTP', res.status, url.slice(0, 120));
      return null;
    }
    const { road } = await readRoadFromResponse(res);
    if (road) {
      cache.set(key, { road, at: now });
    }
    return road;
  } catch {
    return null;
  }
}
