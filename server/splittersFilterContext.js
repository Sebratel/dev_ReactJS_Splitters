/**
 * Constrói WHERE + status SQL e parâmetros para listagem de splitters.
 * Manter alinhado com GET /api/splitters.
 *
 * @param {import('express').Request} req
 * @param {string} splittersBaseQuery SQL embebido (constante SPLITTERS_BASE_QUERY do index).
 */
function parseOptionalIntQuery(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Grupos numéricos antes da primeira `/` — espelho da regra na UI/massiva.
 *
 * @param {string} baseAlias
 * @param {string} columnDoubleQuoted ex.: `"SPLT.SECUNDARIO"`
 */
function buildDigitGroupsBeforeSlashSql(baseAlias, columnDoubleQuoted) {
  return `(
    SELECT array_agg(m[1] ORDER BY ord)
    FROM regexp_matches(
      split_part(trim(COALESCE(${baseAlias}.${columnDoubleQuoted}, '')::text), '/', 1),
      '[0-9]+',
      'g'
    ) WITH ORDINALITY AS dt(m, ord)
  )`;
}

/**
 * @param {string} [baseAlias]
 */
function buildResolvedOltPonExpressions(baseAlias = 'base') {
  const titleArr = buildDigitGroupsBeforeSlashSql(baseAlias, '"SPLT.SECUNDARIO"');
  const codeArr = buildDigitGroupsBeforeSlashSql(baseAlias, '"CÓDIGO[SPLT.SECUNDARIO]"');
  const titleCard = `COALESCE(cardinality(${titleArr}), 0)`;
  const codeCard = `COALESCE(cardinality(${codeArr}), 0)`;

  const slotExpr = `(
    CASE
      WHEN ${titleCard} >= 2 THEN (${titleArr}[cardinality(${titleArr}) - 1])::int
      WHEN ${codeCard} >= 2 THEN (${codeArr}[cardinality(${codeArr}) - 1])::int
      ELSE COALESCE(${baseAlias}."SLOT[SPLT.SECUNDARIO]"::int, 0)
    END
  )`;

  const portExpr = `(
    CASE
      WHEN ${titleCard} >= 2 THEN (${titleArr}[cardinality(${titleArr})])::int
      WHEN ${codeCard} >= 2 THEN (${codeArr}[cardinality(${codeArr})])::int
      ELSE COALESCE(
        ${baseAlias}."PORTA EXTRAÍDA[SPLT.SECUNDARIO]"::int,
        ${baseAlias}."PORTA[SPLT.PRIMARIO]"::int,
        0
      )
    END
  )`;

  return { slotExpr, portExpr };
}

export function buildSplittersFilterContext(req, splittersBaseQuery) {
  const search = req.query.search || '';
  const oltCodes = req.query.olts ? req.query.olts.split(',') : [];
  const statuses = req.query.statuses ? req.query.statuses.split(',') : [];
  const streetSelections = req.query.streets ? req.query.streets.split(',') : [];
  const citySelections = req.query.cities ? req.query.cities.split(',') : [];
  const condominiumSelections = req.query.condominiums
    ? req.query.condominiums.split(',')
    : [];
  const withOpenMassivaRaw = String(req.query.withOpenMassiva || '').trim();
  const withMaintenanceRaw = String(req.query.withMaintenance || '').trim();
  const corporateClientsRaw = String(req.query.corporateClients || '')
    .trim()
    .toLowerCase();
  const openMassivaSplitterCodes = req.query.openMassivaSplitterCodes
    ? req.query.openMassivaSplitterCodes.split(',')
    : [];
  const maintenanceSplitterCodes = req.query.maintenanceSplitterCodes
    ? req.query.maintenanceSplitterCodes.split(',')
    : [];
  const primarySplitters = req.query.primarySplitters
    ? req.query.primarySplitters.split(',')
    : [];

  const oltSlotFilter = parseOptionalIntQuery(req.query.oltSlot);
  const oltPortFilter = parseOptionalIntQuery(req.query.oltPort);

  const values = [];
  let currentParam = 1;

  const whereClauses = [];

  if (search) {
    whereClauses.push(`(
        base."SPLT.SECUNDARIO" ILIKE $${currentParam}
        OR base."CÓDIGO[SPLT.SECUNDARIO]" ILIKE $${currentParam}
        OR base."NOME CLIENTE" ILIKE $${currentParam}
        OR base."USUÁRIO[CLIENTE]" ILIKE $${currentParam}
        OR base."CODIGO_INTEGRACAO" ILIKE $${currentParam}
      )`);
    values.push(`%${search}%`);
    currentParam++;
  }

  const normalizedOltCodes = oltCodes
    .map((code) => String(code || '').trim())
    .filter((code) => code !== '');
  if (normalizedOltCodes.length > 0) {
    whereClauses.push(
      `COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''), TRIM(base."PONTO DE ACESSO")) = ANY($${currentParam})`,
    );
    values.push(normalizedOltCodes);
    currentParam++;
  }

  const normalizedPrimarySplitters = primarySplitters
    .map((title) => String(title || '').trim())
    .filter((title) => title !== '');

  if (normalizedPrimarySplitters.length > 0) {
    whereClauses.push(`TRIM(base."SPLT.PRIMARIO") = ANY($${currentParam})`);
    values.push(normalizedPrimarySplitters);
    currentParam++;
  }

  const normalizedStreetSelections = streetSelections
    .map((street) => String(street || '').trim())
    .filter((street) => street !== '');
  if (normalizedStreetSelections.length > 0) {
    const orParts = normalizedStreetSelections.map(
      (_, idx) => `base."RUA[SPLT.SECUNDARIO]" ILIKE $${currentParam + idx}`,
    );
    whereClauses.push(`(${orParts.join(' OR ')})`);
    for (const street of normalizedStreetSelections) {
      values.push(`%${street}%`);
    }
    currentParam += normalizedStreetSelections.length;
  }

  const normalizedCitySelections = citySelections
    .map((city) => String(city || '').trim())
    .filter((city) => city !== '');
  if (normalizedCitySelections.length > 0) {
    whereClauses.push(`TRIM(base."CIDADE[SPLT.SECUNDARIO]") = ANY($${currentParam})`);
    values.push(normalizedCitySelections);
    currentParam++;
  }

  const normalizedCondominiumSelections = condominiumSelections
    .map((name) => String(name || '').trim())
    .filter((name) => name !== '');
  if (normalizedCondominiumSelections.length > 0) {
    whereClauses.push(`TRIM(base."NOME CONDOMÍNIO") = ANY($${currentParam})`);
    values.push(normalizedCondominiumSelections);
    currentParam++;
  }

  if (oltSlotFilter !== null || oltPortFilter !== null) {
    const { slotExpr, portExpr } = buildResolvedOltPonExpressions('base');
    if (oltSlotFilter !== null) {
      whereClauses.push(`${slotExpr} = $${currentParam}`);
      values.push(oltSlotFilter);
      currentParam++;
    }
    if (oltPortFilter !== null) {
      whereClauses.push(`${portExpr} = $${currentParam}`);
      values.push(oltPortFilter);
      currentParam++;
    }
  }

  const normalizedOpenMassivaSplitterCodes = openMassivaSplitterCodes
    .map((code) => String(code || '').trim())
    .filter((code) => code !== '');
  const withOpenMassiva =
    withOpenMassivaRaw === '1' ? true : withOpenMassivaRaw === '0' ? false : null;
  if (withOpenMassiva !== null) {
    if (normalizedOpenMassivaSplitterCodes.length === 0) {
      if (withOpenMassiva) {
        whereClauses.push('1 = 0');
      }
    } else {
      whereClauses.push(
        withOpenMassiva
          ? `base."CÓDIGO[SPLT.SECUNDARIO]" = ANY($${currentParam})`
          : `base."CÓDIGO[SPLT.SECUNDARIO]" <> ALL($${currentParam})`,
      );
      values.push(normalizedOpenMassivaSplitterCodes);
      currentParam++;
    }
  }

  const normalizedMaintenanceSplitterCodes = maintenanceSplitterCodes
    .map((code) => String(code || '').trim())
    .filter((code) => code !== '');
  const withMaintenance =
    withMaintenanceRaw === '1' ? true : withMaintenanceRaw === '0' ? false : null;
  if (withMaintenance !== null) {
    if (normalizedMaintenanceSplitterCodes.length === 0) {
      if (withMaintenance) {
        whereClauses.push('1 = 0');
      }
    } else {
      whereClauses.push(
        withMaintenance
          ? `base."CÓDIGO[SPLT.SECUNDARIO]" = ANY($${currentParam})`
          : `base."CÓDIGO[SPLT.SECUNDARIO]" <> ALL($${currentParam})`,
      );
      values.push(normalizedMaintenanceSplitterCodes);
      currentParam++;
    }
  }

  if (corporateClientsRaw === 'with' || corporateClientsRaw === 'with-corporate') {
    whereClauses.push('base."CORPORATIVO" IS TRUE');
  } else if (
    corporateClientsRaw === 'without' ||
    corporateClientsRaw === 'without-corporate'
  ) {
    whereClauses.push(`NOT EXISTS (
        SELECT 1
        FROM (${splittersBaseQuery}) corp_base
        WHERE corp_base."ID[SPLT.SECUNDARIO]" = base."ID[SPLT.SECUNDARIO]"
          AND corp_base."CORPORATIVO" IS TRUE
      )`);
  }

  const normalizedStatuses = statuses
    .map((status) => String(status || '').trim().toLowerCase())
    .filter((status) => ['normal', 'alerta', 'critico', 'excedente'].includes(status));

  let statusSql = '';
  if (normalizedStatuses.length > 0) {
    statusSql = `
        WHERE (
          CASE
            WHEN detailed."CAPACIDADE[SPLT.SECUNDARIO]" IS NULL
              OR detailed."CAPACIDADE[SPLT.SECUNDARIO]" <= 0 THEN 'normal'
            WHEN detailed."BUSY_COUNT" > detailed."CAPACIDADE[SPLT.SECUNDARIO]" THEN 'excedente'
            WHEN detailed."BUSY_COUNT" = detailed."CAPACIDADE[SPLT.SECUNDARIO]" THEN 'critico'
            WHEN (detailed."BUSY_COUNT"::double precision / NULLIF(detailed."CAPACIDADE[SPLT.SECUNDARIO]", 0)) > 0.7 THEN 'alerta'
            ELSE 'normal'
          END
        ) = ANY($${currentParam})
      `;
    values.push(normalizedStatuses);
    currentParam++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return { whereSql, values, statusSql, currentParam };
}
