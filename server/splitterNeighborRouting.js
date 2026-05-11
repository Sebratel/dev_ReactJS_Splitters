/**
 * Vizinhos geográficos + distâncias OSRM (perfil foot = calçada/vias pedestres).
 * Usado no mapa do splitter e na fila de planejamento (alívio de rede).
 */

import { fetchRoadFromReverseGeocode, isReverseGeocodeDisabled } from './reverseGeocode.js';

function normalizeNumericSql(expression) {
  return `NULLIF(REPLACE(REGEXP_REPLACE(TRIM(${expression}::text), '[^0-9,.-]', '', 'g'), ',', '.'), '')::double precision`;
}

const CONDOMINIUM_TITLE_PREFIX_REGEX = /\b(?:RES|COND|ED)\./i;
const STREET_RELIEF_MAX_ROUTE_METERS = 200;
const CROSS_STREET_RELIEF_MAX_ROUTE_METERS = 30;

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
  const rows = nRes.rows ?? [];

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

/**
 * @param {import('pg').Pool} pool
 * @param {string} code
 * @param {{ straightRadiusMeters: number, maxRouteMeters: number }} opts
 */
export async function evaluateReliefForSplitter(pool, code, opts) {
  const { straightRadiusMeters, maxRouteMeters } = opts;

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
  let targetStreet = normalizeStreetForRelief(targetRowRes.rows?.[0]?.street);
  const targetLat = Number(targetRowRes.rows?.[0]?.lat);
  const targetLng = Number(targetRowRes.rows?.[0]?.lng);
  if (
    targetStreet == null &&
    !isReverseGeocodeDisabled() &&
    Number.isFinite(targetLat) &&
    Number.isFinite(targetLng)
  ) {
    const road = await fetchRoadFromReverseGeocode(targetLat, targetLng);
    if (road && String(road).trim() !== '') {
      targetStreet = normalizeStreetForRelief(String(road).trim());
    }
  }
  const targetIsCondominium = isCondominiumSplitterTitle(targetTitle);

  const condominiumRelief = await hasIntraCondominiumFreePortSibling(pool, code);
  if (targetIsCondominium && condominiumRelief) {
    return {
      hasReliefWithinRoute: true,
      routingOk: true,
      straightNeighborsCount: 0,
      condominiumRelief: true,
    };
  }
  if (targetIsCondominium) {
    return {
      hasReliefWithinRoute: false,
      routingOk: true,
      straightNeighborsCount: 0,
      condominiumRelief: false,
    };
  }

  const { origin, neighbors } = await querySplitterNeighborsWithOrigin(
    pool,
    code,
    straightRadiusMeters,
  );

  const streetNeighbors = neighbors.filter(
    (n) => !isCondominiumSplitterTitle(n.title),
  );

  if (!origin || streetNeighbors.length === 0) {
    return {
      hasReliefWithinRoute: false,
      routingOk: true,
      straightNeighborsCount: streetNeighbors.length,
    };
  }

  const capped = streetNeighbors.slice(0, 80);
  let routeMeters;
  try {
    routeMeters = await fetchOsrmFootDistanceRowMeters(
      origin,
      capped.map((n) => ({ lat: Number(n.lat), lng: Number(n.lng) })),
    );
  } catch {
    return {
      hasReliefWithinRoute: false,
      routingOk: false,
      straightNeighborsCount: capped.length,
    };
  }

  /** Mesma ideia do mapa / `enrichNeighborStreetsForMap`: via sem cadastro ainda conta para “mesma rua”. */
  const neighborStreetNorm = capped.map((n) => normalizeStreetForRelief(n.street));
  if (!isReverseGeocodeDisabled()) {
    const delayMs = Math.max(
      0,
      Math.trunc(Number.parseInt(String(process.env.REVERSE_GEOCODE_RELIEF_NEIGHBORS_DELAY_MS ?? ''), 10) || 1100),
    );
    const maxNbr = Math.min(
      Math.max(Math.trunc(Number.parseInt(String(process.env.REVERSE_GEOCODE_RELIEF_NEIGHBORS_MAX ?? ''), 10) || 6), 0),
      12,
    );
    if (maxNbr > 0) {
      const idxs = capped
        .map((_, i) => i)
        .filter((i) => {
          if (neighborStreetNorm[i] != null) return false;
          const rm = routeMeters[i];
          if (rm == null || rm > maxRouteMeters) return false;
          return Number.isFinite(Number(capped[i].lat)) && Number.isFinite(Number(capped[i].lng));
        })
        .sort((i, j) => (Number(routeMeters[i]) || 1e9) - (Number(routeMeters[j]) || 1e9))
        .slice(0, maxNbr);
      for (let j = 0; j < idxs.length; j += 1) {
        const i = idxs[j];
        const road = await fetchRoadFromReverseGeocode(Number(capped[i].lat), Number(capped[i].lng));
        if (road && String(road).trim() !== '') {
          neighborStreetNorm[i] = normalizeStreetForRelief(String(road).trim());
        }
        if (j < idxs.length - 1 && delayMs > 0) {
          await new Promise((r) => {
            setTimeout(r, delayMs);
          });
        }
      }
    }
  }

  for (let i = 0; i < capped.length; i++) {
    const rm = routeMeters[i];
    if (rm == null) continue;
    const neighborStreet = neighborStreetNorm[i];
    const sameStreet =
      targetStreet !== null &&
      neighborStreet !== null &&
      targetStreet === neighborStreet;
    const routeLimit = sameStreet
      ? maxRouteMeters
      : Math.min(maxRouteMeters, CROSS_STREET_RELIEF_MAX_ROUTE_METERS);
    if (rm > routeLimit) continue;
    const outPorts = Number(capped[i].outPorts ?? 0);
    const busyCount = Number(capped[i].busyCount ?? 0);
    if (outPorts > 0 && busyCount < outPorts) {
      return {
        hasReliefWithinRoute: true,
        routingOk: true,
        straightNeighborsCount: capped.length,
      };
    }
  }

  return {
    hasReliefWithinRoute: false,
    routingOk: true,
    straightNeighborsCount: capped.length,
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
