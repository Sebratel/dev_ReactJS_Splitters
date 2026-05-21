/**
 * Vizinhos geográficos + distâncias OSRM (perfil foot = calçada/vias pedestres).
 * Usado no mapa do splitter e na fila de planejamento (alívio de rede).
 */

import { fetchRoadFromReverseGeocode, isReverseGeocodeDisabled } from './reverseGeocode.js';

function normalizeNumericSql(expression) {
  return `NULLIF(REPLACE(REGEXP_REPLACE(TRIM(${expression}::text), '[^0-9,.-]', '', 'g'), ',', '.'), '')::double precision`;
}

const CONDOMINIUM_TITLE_PREFIX_REGEX = /\b(?:RES|COND|ED)\./i;
export const STREET_RELIEF_MAX_ROUTE_METERS = 200;
const CROSS_STREET_RELIEF_MAX_ROUTE_METERS = 30;

/** Mesmo raio em linha reta do mapa do detalhe (`SPLITTER_MAP_NEIGHBOR_RADIUS_METERS` no frontend). */
export const SPLITTER_MAP_STRAIGHT_RADIUS_METERS = 200;

/** Paridade com `NEIGHBOR_CLIENT_GEOCODE_MAX` no hook do mapa. */
export const RELIEF_NEIGHBOR_GEOCODE_MAX = 14;

/**
 * Índices dos vizinhos sem rua no cadastro a geocodificar — mesma ordem do mapa
 * (`useNeighborStreetsReverseGeocode.sortNeighborTargetsForStreet`).
 * @param {Array<{ isCondominium?: boolean, streetNormalized?: string | null, routeMeters?: number | null, distanceMeters?: number, lat?: number, lng?: number, outPorts?: number, busyCount?: number }>} analyzedNeighbors
 * @param {number} maxPick
 * @returns {number[]}
 */
export function pickNeighborIndexesForReliefStreetGeocode(analyzedNeighbors, maxPick) {
  const cap = Math.min(Math.max(Math.trunc(maxPick), 0), RELIEF_NEIGHBOR_GEOCODE_MAX);
  if (cap === 0) return [];

  const empty = analyzedNeighbors
    .map((neighbor, index) => ({ neighbor, index }))
    .filter(({ neighbor }) => {
      if (neighbor.isCondominium) return false;
      if (neighbor.streetNormalized != null) return false;
      return Number.isFinite(Number(neighbor.lat)) && Number.isFinite(Number(neighbor.lng));
    });

  const routeDist = ({ neighbor }) => {
    const rm = neighbor.routeMeters;
    if (rm != null && Number.isFinite(Number(rm))) return Number(rm);
    return Number(neighbor.distanceMeters ?? 1e9);
  };

  const hasFreePort = ({ neighbor }) => {
    const outPorts = Number(neighbor.outPorts ?? 0);
    const busyCount = Number(neighbor.busyCount ?? 0);
    return outPorts > 0 && busyCount < outPorts;
  };

  const tier = ({ neighbor }) => (neighbor.isCondominium ? 2 : hasFreePort({ neighbor }) ? 0 : 1);

  return empty
    .sort((a, b) => {
      const d = routeDist(a) - routeDist(b);
      if (d !== 0) return d;
      return tier(a) - tier(b);
    })
    .slice(0, cap)
    .map(({ index }) => index);
}

/**
 * Mesma regra do mapa (`findFirstStreetReliefNeighbor` no frontend).
 * @param {Array<{ isCondominium?: boolean, streetNormalized?: string | null, routeMeters?: number | null, outPorts?: number, busyCount?: number }>} analyzedNeighbors
 * @param {string | null} targetStreetNormalized
 * @param {number} maxRouteMeters
 * @returns {typeof analyzedNeighbors[number] | null}
 */
export function findFirstReliefMatchFromAnalyzed(
  analyzedNeighbors,
  targetStreetNormalized,
  maxRouteMeters,
) {
  for (const neighbor of analyzedNeighbors) {
    const rm = neighbor.routeMeters;
    if (neighbor.isCondominium || rm == null) continue;
    const sameStreet =
      targetStreetNormalized !== null &&
      neighbor.streetNormalized !== null &&
      targetStreetNormalized === neighbor.streetNormalized;
    const routeLimit = sameStreet
      ? maxRouteMeters
      : Math.min(maxRouteMeters, CROSS_STREET_RELIEF_MAX_ROUTE_METERS);
    if (Number(rm) > routeLimit) continue;
    const outPorts = Number(neighbor.outPorts ?? 0);
    const busyCount = Number(neighbor.busyCount ?? 0);
    if (outPorts > 0 && busyCount < outPorts) {
      return neighbor;
    }
  }
  return null;
}

/**
 * Mesmo critério do SPLITTERS_BASE_QUERY para classificar condomínio pelo título.
 * @param {unknown} title
 * @returns {boolean}
 */
export function isCondominiumSplitterTitle(title) {
  return CONDOMINIUM_TITLE_PREFIX_REGEX.test(String(title ?? ''));
}

export function normalizeStreetForRelief(street) {
  const normalized = String(street ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutPrefix = normalized.replace(
    /^(rua|r|avenida|av|travessa|trav|alameda|estrada|rodovia|beco|largo|praca|praça)\s+/,
    '',
  );
  const withoutJoiners = withoutPrefix
    .replace(/\b(de|da|do|das|dos)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutJoiners === '' ? null : withoutJoiners;
}

/**
 * Permite resolver um splitter tanto pelo código interno quanto pelo título operacional exibido na UI.
 * @param {string} alias
 * @param {string} paramRef
 */
export function splitterIdentifierMatchSql(alias, paramRef = '$1') {
  return `(
    TRIM(${alias}.code::text) = TRIM(${paramRef}::text)
    OR TRIM(${alias}.title::text) = TRIM(${paramRef}::text)
  )`;
}

/**
 * Chave normalizada do “site” no condomínio (paridade `nome_condominio` no SPLITTERS_BASE_QUERY — RES./COND./ED.).
 * @param {string} alias Alias SQL da tabela `authentication_splitters`.
 */
function condoSiteKeySql(alias) {
  const a = alias;
  return `CASE
    WHEN ${a}.title ~* '\\mCOND\\.' THEN lower(trim(regexp_replace(regexp_replace(${a}.title, '.*\\mCOND\\.\\s*', '', 'gi'), '\\s+', ' ', 'g')))
    WHEN ${a}.title ~* '\\mRES\\.' THEN lower(trim(regexp_replace(regexp_replace(${a}.title, '.*\\mRES\\.\\s*', '', 'gi'), '\\s+', ' ', 'g')))
    WHEN ${a}.title ~* '\\mED\\.' THEN lower(trim(regexp_replace(regexp_replace(${a}.title, '.*\\mED\\.\\s*', '', 'gi'), '\\s+', ' ', 'g')))
    ELSE NULL
  END`;
}

/**
 * Outro splitter secundário (filho de primário type=2) no mesmo condomínio/bloco pelo título (COND./RES./ED.),
 * com pelo menos uma porta livre.
 * @param {import('pg').Pool} pool
 * @param {string} code
 */
export async function hasIntraCondominiumFreePortSibling(pool, code) {
  const ck = condoSiteKeySql;
  const query = `
    WITH target AS (
      SELECT (${ck('t')}) AS condo_key, trim(t.code::text) AS code
      FROM authentication_splitters t
      WHERE ${splitterIdentifierMatchSql('t')}
        AND t.active IS TRUE
        AND t.deleted IS FALSE
      LIMIT 1
    )
    SELECT EXISTS (
      SELECT 1
      FROM authentication_splitters s
      CROSS JOIN target tg
      WHERE tg.condo_key IS NOT NULL
        AND (${ck('s')}) = tg.condo_key
        AND trim(s.code::text) <> tg.code
        AND s.active IS TRUE
        AND s.deleted IS FALSE
        AND EXISTS (
          SELECT 1
          FROM authentication_splitter_ports asp_parent
          INNER JOIN authentication_splitters primary_row
            ON primary_row.id = asp_parent.authentication_splitter_id
          WHERE asp_parent.children_authentication_splitter_id = s.id
            AND asp_parent.deleted IS FALSE
            AND primary_row.active IS TRUE
            AND primary_row.deleted IS FALSE
            AND primary_row."type" = 2
        )
        AND COALESCE(s.out_ports::int, 0) > 0
        AND (
          SELECT COUNT(*)::int
          FROM authentication_splitter_ports asp
          WHERE asp.authentication_splitter_id = s.id
            AND asp.busy IS TRUE
            AND asp.deleted IS FALSE
        ) < COALESCE(s.out_ports::int, 0)
    ) AS ok;
  `;

  const result = await pool.query(query, [code]);
  return Boolean(result.rows?.[0]?.ok);
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} code
 * @param {number} radiusMeters
 * @returns {Promise<{ origin: { lat: number, lng: number } | null, neighbors: Array<Record<string, unknown>> }>}
 */
export async function querySplitterNeighborsWithOrigin(pool, code, radiusMeters) {
  /**
   * Rua: mesma regra que SPLITTERS_BASE_QUERY — splitter e, se vazio, endereço da caixa (`network_box_addresses`).
   * Coordenadas: `COALESCE(caixa, splitter)` como na lista — OSRM e reverse geocode alinham com o mapa.
   */
  const normLat = normalizeNumericSql('COALESCE(nba.latitude, as4.lat)');
  const normLng = normalizeNumericSql('COALESCE(nba.longitude, as4.lng)');

  const resolvedStreetSql = `
    COALESCE(
      NULLIF(TRIM(as4.street::text), ''),
      NULLIF(TRIM(nba.street::text), '')
    )
  `;

  const networkBoxAddressJoins = `
      LEFT JOIN network_boxes nb ON nb.id = as4.network_box_id
      LEFT JOIN network_box_addresses nba ON nba.id = nb.network_box_address_id
  `;

  const originSql = `
      SELECT
        as4.id AS id,
        as4.title AS title,
        ${resolvedStreetSql} AS street,
        ${normLat} AS lat,
        ${normLng} AS lng
      FROM authentication_splitters AS as2
      LEFT JOIN authentication_splitter_ports asp
        ON asp.authentication_splitter_id = as2.id
      LEFT JOIN authentication_splitters as4
        ON as4.id = asp.children_authentication_splitter_id
      ${networkBoxAddressJoins}
      WHERE
        ${splitterIdentifierMatchSql('as4')}
        AND as2.active IS TRUE
        AND as2.deleted IS FALSE
        AND asp.deleted IS FALSE
        AND as2."type" = 2
        AND ${normLat} IS NOT NULL
        AND ${normLng} IS NOT NULL
      ORDER BY as4.id ASC
      LIMIT 1;
    `;

  const originRes = await pool.query(originSql, [code]);
  const or0 = originRes.rows?.[0];
  if (!or0) {
    return { origin: null, neighbors: [], originIsCondominium: false, originStreet: null };
  }

  const oLat = Number(or0.lat);
  const oLng = Number(or0.lng);
  const csId = Number(or0.id);
  if (!Number.isFinite(oLat) || !Number.isFinite(oLng) || !Number.isFinite(csId)) {
    return { origin: null, neighbors: [], originIsCondominium: false, originStreet: null };
  }

  const neighborsSql = `
      SELECT DISTINCT ON (as4.id)
        as4.code AS "code",
        as4.title AS "title",
        ${resolvedStreetSql} AS "street",
        as4.out_ports AS "outPorts",
        (
          SELECT COUNT(*)
          FROM authentication_splitter_ports asp_sub
          WHERE asp_sub.authentication_splitter_id = as4.id
            AND asp_sub.busy IS TRUE
            AND asp_sub.deleted IS FALSE
        ) AS "busyCount",
        ${normLat} AS "lat",
        ${normLng} AS "lng",
        (
          6371000 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS($1::double precision))
                * COS(RADIANS(${normLat}))
                * COS(RADIANS(${normLng}) - RADIANS($2::double precision))
                + SIN(RADIANS($1::double precision))
                * SIN(RADIANS(${normLat}))
              )
            )
          )
        ) AS "distanceMeters"
      FROM authentication_splitters AS as2
      JOIN authentication_splitter_ports asp
        ON asp.authentication_splitter_id = as2.id
        AND asp.deleted IS FALSE
      JOIN authentication_splitters as4
        ON as4.id = asp.children_authentication_splitter_id
      ${networkBoxAddressJoins}
      WHERE
        as2.active IS TRUE
        AND as2.deleted IS FALSE
        AND as2."type" = 2
        AND as4.id <> $4::bigint
        AND ${normLat} IS NOT NULL
        AND ${normLng} IS NOT NULL
        AND (
          6371000 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS($1::double precision))
                * COS(RADIANS(${normLat}))
                * COS(RADIANS(${normLng}) - RADIANS($2::double precision))
                + SIN(RADIANS($1::double precision))
                * SIN(RADIANS(${normLat}))
              )
            )
          )
        ) <= $3::double precision
      ORDER BY as4.id ASC, "distanceMeters" ASC;
    `;

  const nRes = await pool.query(neighborsSql, [oLat, oLng, radiusMeters, csId]);
  /** DISTINCT ON exige ORDER BY id no SQL; reordenamos por distância para cap / OSRM / alívio serem simétricos. */
  const rows = (nRes.rows ?? []).slice().sort((a, b) => {
    const da = Number(a.distanceMeters ?? 0);
    const db = Number(b.distanceMeters ?? 0);
    return da - db;
  });

  const origin = { lat: oLat, lng: oLng };
  const originIsCondominium = isCondominiumSplitterTitle(or0.title);
  const originStreet = normalizeStreetForRelief(or0.street);
  return { origin, neighbors: rows, originIsCondominium, originStreet };
}

const OSRM_DEFAULT_BASE = 'https://router.project-osrm.org';

/**
 * Distâncias em metros (perfil foot) da origem para cada destino, na mesma ordem.
 * @returns {(number | null)[]}
 */
export async function fetchOsrmFootDistanceRowMeters(origin, destinations) {
  if (destinations.length === 0) return [];

  const base = (process.env.OSRM_BASE_URL || OSRM_DEFAULT_BASE).replace(/\/+$/, '');
  const coords = [origin, ...destinations]
    .map((p) => `${Number(p.lng)},${Number(p.lat)}`)
    .join(';');

  const destIndices = destinations.map((_, i) => i + 1).join(';');
  const url = `${base}/table/v1/foot/${coords}?sources=0&destinations=${destIndices}&annotations=distance`;

  const controller = new AbortController();
  const timeoutMs = Number.parseInt(String(process.env.OSRM_TIMEOUT_MS ?? '8000'), 10);
  const t = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Sebratel-BFF-Splitters/1.1' },
    });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OSRM HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.code !== 'Ok') {
      throw new Error(data.message || 'OSRM resposta não Ok');
    }
    const row = data.distances?.[0];
    if (!Array.isArray(row)) {
      throw new Error('OSRM matriz de distâncias ausente');
    }
    return row.map((d) =>
      d == null || !Number.isFinite(Number(d)) ? null : Math.round(Number(d)),
    );
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function trimNullable(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

/**
 * Consolida alvo, vizinhos, distâncias por rota e fallback de rua por reverse geocode.
 * A ISA pode reutilizar este resultado sem repetir query de vizinhos + OSRM.
 *
 * @param {import('pg').Pool} pool
 * @param {string} code
 * @param {{ straightRadiusMeters: number, maxRouteMeters: number, reliefGeocodeNeighborMax?: number }} opts
 */
export async function analyzeStreetReliefContext(pool, code, opts) {
  const { straightRadiusMeters, maxRouteMeters } = opts;
  const geocodeCapFromOpts =
    opts.reliefGeocodeNeighborMax == null
      ? null
      : Math.min(
          Math.max(Math.trunc(Number(opts.reliefGeocodeNeighborMax)), 0),
          RELIEF_NEIGHBOR_GEOCODE_MAX,
        );
  /** Captura em massa / paridade com `neighbors-routed`: só PG + OSRM, sem Nominatim no servidor. */
  const skipAllReverseGeocode =
    opts.skipReliefReverseGeocode === true || geocodeCapFromOpts === 0;

  const tgtLatSql = normalizeNumericSql('COALESCE(nba.latitude, t.lat)');
  const tgtLngSql = normalizeNumericSql('COALESCE(nba.longitude, t.lng)');

  const targetRowRes = await pool.query(
    `
      SELECT t.title,
        COALESCE(
          NULLIF(TRIM(t.street::text), ''),
          NULLIF(TRIM(nba.street::text), '')
        ) AS street,
        ${tgtLatSql} AS lat,
        ${tgtLngSql} AS lng
      FROM authentication_splitters t
      LEFT JOIN network_boxes nb ON nb.id = t.network_box_id
      LEFT JOIN network_box_addresses nba ON nba.id = nb.network_box_address_id
      WHERE ${splitterIdentifierMatchSql('t')}
        AND t.active IS TRUE
        AND t.deleted IS FALSE
      LIMIT 1
    `,
    [code],
  );

  const targetTitle = targetRowRes.rows?.[0]?.title ?? '';
  let targetStreetDisplay = trimNullable(targetRowRes.rows?.[0]?.street);
  let targetStreetNormalized = normalizeStreetForRelief(targetStreetDisplay);
  const targetLat = Number(targetRowRes.rows?.[0]?.lat);
  const targetLng = Number(targetRowRes.rows?.[0]?.lng);
  if (
    !skipAllReverseGeocode &&
    targetStreetNormalized == null &&
    !isReverseGeocodeDisabled() &&
    Number.isFinite(targetLat) &&
    Number.isFinite(targetLng)
  ) {
    const road = await fetchRoadFromReverseGeocode(targetLat, targetLng);
    const roadText = trimNullable(road);
    if (roadText) {
      targetStreetDisplay = roadText;
      targetStreetNormalized = normalizeStreetForRelief(roadText);
    }
  }

  const targetIsCondominium = isCondominiumSplitterTitle(targetTitle);
  const condominiumRelief = await hasIntraCondominiumFreePortSibling(pool, code);
  if (targetIsCondominium) {
    return {
      origin: null,
      originIsCondominium: true,
      targetStreetDisplay,
      targetStreetNormalized,
      routingOk: true,
      condominiumRelief,
      straightNeighborsCount: 0,
      analyzedNeighbors: [],
      reliefMatch: null,
    };
  }

  const { origin, neighbors, originIsCondominium } = await querySplitterNeighborsWithOrigin(
    pool,
    code,
    straightRadiusMeters,
  );

  const capped = Array.isArray(neighbors) ? neighbors.slice(0, 80) : [];
  if (!origin || capped.length === 0) {
    return {
      origin,
      originIsCondominium: Boolean(originIsCondominium),
      targetStreetDisplay,
      targetStreetNormalized,
      routingOk: true,
      condominiumRelief: false,
      straightNeighborsCount: capped.filter((n) => !isCondominiumSplitterTitle(n?.title)).length,
      analyzedNeighbors: capped.map((neighbor) => ({
        ...neighbor,
        isCondominium: isCondominiumSplitterTitle(neighbor?.title),
        routeMeters: null,
        streetDisplay: trimNullable(neighbor?.street),
        streetNormalized: normalizeStreetForRelief(neighbor?.street),
        sameStreet: false,
      })),
      reliefMatch: null,
    };
  }

  let routeMeters;
  try {
    routeMeters = await fetchOsrmFootDistanceRowMeters(
      origin,
      capped.map((n) => ({ lat: Number(n.lat), lng: Number(n.lng) })),
    );
  } catch {
    return {
      origin,
      originIsCondominium: Boolean(originIsCondominium),
      targetStreetDisplay,
      targetStreetNormalized,
      routingOk: false,
      condominiumRelief: false,
      straightNeighborsCount: capped.filter((n) => !isCondominiumSplitterTitle(n?.title)).length,
      analyzedNeighbors: capped.map((neighbor) => ({
        ...neighbor,
        isCondominium: isCondominiumSplitterTitle(neighbor?.title),
        routeMeters: null,
        streetDisplay: trimNullable(neighbor?.street),
        streetNormalized: normalizeStreetForRelief(neighbor?.street),
        sameStreet: false,
      })),
      reliefMatch: null,
    };
  }

  const analyzedNeighbors = capped.map((neighbor, index) => ({
    ...neighbor,
    distanceMeters: Number(neighbor.distanceMeters ?? 0),
    isCondominium: isCondominiumSplitterTitle(neighbor?.title),
    routeMeters: routeMeters[index] ?? null,
    streetDisplay: trimNullable(neighbor?.street),
    streetNormalized: normalizeStreetForRelief(neighbor?.street),
    sameStreet: false,
  }));

  if (!skipAllReverseGeocode && !isReverseGeocodeDisabled()) {
    const delayMs = Math.max(
      0,
      Math.trunc(
        Number.parseInt(String(process.env.REVERSE_GEOCODE_RELIEF_NEIGHBORS_DELAY_MS ?? ''), 10) ||
          0,
      ),
    );
    const maxNbr =
      geocodeCapFromOpts ??
      Math.min(
        Math.max(
          Math.trunc(
            Number.parseInt(String(process.env.REVERSE_GEOCODE_RELIEF_NEIGHBORS_MAX ?? ''), 10) ||
              0,
          ),
          0,
        ),
        RELIEF_NEIGHBOR_GEOCODE_MAX,
      );
    const geocodeIndexes = pickNeighborIndexesForReliefStreetGeocode(
      analyzedNeighbors,
      maxNbr,
    );

    for (let j = 0; j < geocodeIndexes.length; j += 1) {
      const index = geocodeIndexes[j];
      const road = await fetchRoadFromReverseGeocode(
        Number(analyzedNeighbors[index].lat),
        Number(analyzedNeighbors[index].lng),
      );
      const roadText = trimNullable(road);
      if (roadText) {
        analyzedNeighbors[index].streetDisplay = roadText;
        analyzedNeighbors[index].streetNormalized = normalizeStreetForRelief(roadText);
      }
      if (j < geocodeIndexes.length - 1 && delayMs > 0) {
        await new Promise((r) => {
          setTimeout(r, delayMs);
        });
      }
    }
  }

  const reliefMatch = findFirstReliefMatchFromAnalyzed(
    analyzedNeighbors,
    targetStreetNormalized,
    maxRouteMeters,
  );
  if (reliefMatch) {
    reliefMatch.sameStreet =
      targetStreetNormalized !== null &&
      reliefMatch.streetNormalized !== null &&
      targetStreetNormalized === reliefMatch.streetNormalized;
  }

  return {
    origin,
    originIsCondominium: Boolean(originIsCondominium),
    targetStreetDisplay,
    targetStreetNormalized,
    routingOk: true,
    condominiumRelief: false,
    straightNeighborsCount: analyzedNeighbors.filter((n) => !n.isCondominium).length,
    analyzedNeighbors,
    reliefMatch,
  };
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} code
 * @param {{ straightRadiusMeters: number, maxRouteMeters: number }} opts
 */
/**
 * Mesma avaliação do mapa do detalhe: OSRM 200 m + geocode origem/vizinhos (até 14) + 200/30 m por rua.
 * Usado na captura da fila de planejamento para espelhar o alerta "sem alívio" do mapa.
 */
export async function evaluateReliefForMapMirror(pool, code, opts) {
  return evaluateReliefForSplitter(pool, code, {
    straightRadiusMeters: opts.straightRadiusMeters,
    maxRouteMeters: opts.maxRouteMeters,
    reliefGeocodeNeighborMax: RELIEF_NEIGHBOR_GEOCODE_MAX,
    skipReliefReverseGeocode: false,
  });
}

export async function evaluateReliefForSplitter(pool, code, opts) {
  const analysis = await analyzeStreetReliefContext(pool, code, {
    straightRadiusMeters: opts.straightRadiusMeters,
    maxRouteMeters: opts.maxRouteMeters,
    reliefGeocodeNeighborMax: opts.reliefGeocodeNeighborMax,
    skipReliefReverseGeocode: opts.skipReliefReverseGeocode,
  });

  if (analysis.originIsCondominium && analysis.condominiumRelief) {
    return {
      hasReliefWithinRoute: true,
      routingOk: true,
      straightNeighborsCount: 0,
      condominiumRelief: true,
      reliefNeighborCode: null,
      reliefNeighborTitle: null,
      reliefNeighborRouteMeters: null,
    };
  }
  if (analysis.originIsCondominium) {
    return {
      hasReliefWithinRoute: false,
      routingOk: true,
      straightNeighborsCount: 0,
      condominiumRelief: false,
      reliefNeighborCode: null,
      reliefNeighborTitle: null,
      reliefNeighborRouteMeters: null,
    };
  }
  if (!analysis.origin || analysis.straightNeighborsCount === 0) {
    return {
      hasReliefWithinRoute: false,
      routingOk: true,
      straightNeighborsCount: analysis.straightNeighborsCount,
      reliefNeighborCode: null,
      reliefNeighborTitle: null,
      reliefNeighborRouteMeters: null,
    };
  }
  if (!analysis.routingOk) {
    return {
      hasReliefWithinRoute: false,
      routingOk: false,
      straightNeighborsCount: analysis.straightNeighborsCount,
      reliefNeighborCode: null,
      reliefNeighborTitle: null,
      reliefNeighborRouteMeters: null,
    };
  }
  if (analysis.reliefMatch) {
    const nCode = String(analysis.reliefMatch.code ?? '').trim();
    const nTitle = String(analysis.reliefMatch.title ?? '').trim();
    return {
      hasReliefWithinRoute: true,
      routingOk: true,
      straightNeighborsCount: analysis.straightNeighborsCount,
      reliefNeighborCode: nCode || null,
      reliefNeighborTitle: nTitle || null,
      reliefNeighborRouteMeters:
        analysis.reliefMatch.routeMeters == null
          ? null
          : Math.round(Number(analysis.reliefMatch.routeMeters)),
    };
  }

  return {
    hasReliefWithinRoute: false,
    routingOk: true,
    straightNeighborsCount: analysis.straightNeighborsCount,
    reliefNeighborCode: null,
    reliefNeighborTitle: null,
    reliefNeighborRouteMeters: null,
  };
}

/**
 * Splitters secundários (filhos de primário type=2, paridade hierarquia SPLITTERS_BASE_QUERY)
 * 100% ocupados com GPS, para varredura de alívio. Exclui primários sob AP.
 * @param {import('pg').Pool} pool
 * @param {number} limit
 * @param {number} [offset=0]
 */
export async function queryFullOccupancySplitterCandidates(pool, limit, offset = 0) {
  const normLat = normalizeNumericSql('as4.lat');
  const normLng = normalizeNumericSql('as4.lng');

  const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const query = `
    SELECT
      as4.code AS code,
      as4.title AS title,
      COALESCE(as4.out_ports::int, 0) AS "outPorts",
      (
        SELECT COUNT(*)::int
        FROM authentication_splitter_ports asp
        WHERE asp.authentication_splitter_id = as4.id
          AND asp.busy IS TRUE
          AND asp.deleted IS FALSE
      ) AS "busyCount",
      ${normLat} AS lat,
      ${normLng} AS lng
    FROM authentication_splitters as4
    WHERE
      as4.active IS TRUE
      AND as4.deleted IS FALSE
      AND EXISTS (
        SELECT 1
        FROM authentication_splitter_ports asp_parent
        INNER JOIN authentication_splitters primary_row
          ON primary_row.id = asp_parent.authentication_splitter_id
        WHERE asp_parent.children_authentication_splitter_id = as4.id
          AND asp_parent.deleted IS FALSE
          AND primary_row.active IS TRUE
          AND primary_row.deleted IS FALSE
          AND primary_row."type" = 2
      )
      AND COALESCE(as4.out_ports::int, 0) > 0
      AND (
        SELECT COUNT(*)
        FROM authentication_splitter_ports asp
        WHERE asp.authentication_splitter_id = as4.id
          AND asp.busy IS TRUE
          AND asp.deleted IS FALSE
      ) >= COALESCE(as4.out_ports::int, 0)
      AND ${normLat} IS NOT NULL
      AND ${normLng} IS NOT NULL
    ORDER BY as4.code ASC
    LIMIT $1
    OFFSET $2;
  `;

  const result = await pool.query(query, [lim, off]);
  return result.rows ?? [];
}
