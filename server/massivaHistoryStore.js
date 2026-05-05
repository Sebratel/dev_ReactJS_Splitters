import mysql from 'mysql2/promise';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text === '' ? null : text;
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function uniqueSplitterEntries(entries) {
  const byCode = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const code = normalizeText(entry?.code);
    if (code === '') continue;
    const label = normalizeText(entry?.label) || code;
    if (!byCode.has(code)) byCode.set(code, { code, label });
  }
  return [...byCode.values()];
}

export function createMassivaHistoryStore(config) {
  const host = normalizeText(config.host);
  const port = normalizePositiveInt(config.port) ?? 3306;
  const user = normalizeText(config.user);
  const password = String(config.password ?? '');
  const database = normalizeText(config.database);

  const configured =
    host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async ensureReady() {},
      async registerOpenBatch() {
        return { configured: false, insertedOrUpdated: 0 };
      },
      async registerClose() {
        return { configured: false, updated: 0 };
      },
      async getSplitterStats() {
        return new Map();
      },
      async getOpenSplitterCodes() {
        return [];
      },
      async upsertSplitterSnapshots() {
        return { configured: false, insertedOrUpdated: 0 };
      },
      async getSplitterTrends() {
        return new Map();
      },
      async getOpenMassivaDashboardKpis() {
        return { openMassivas: 0, affectedClientsOpen: 0 };
      },
      async getHistoryList() {
        return [];
      },
      async end() {},
    };
  }

  const dataPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 6,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  let readyPromise = null;

  /** Sem DDL: schema deve existir no MySQL (criação/migração manual no banco). */
  async function ensureReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      await dataPool.query('SELECT 1');
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });

    return readyPromise;
  }

  async function findExistingHistoryId(protocol, assignmentId) {
    if (assignmentId !== null) {
      const [rows] = await dataPool.query(
        'SELECT id FROM massiva_history WHERE assignment_id = ? LIMIT 1',
        [assignmentId],
      );
      if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
    }

    if (protocol !== null) {
      const [rows] = await dataPool.query(
        'SELECT id FROM massiva_history WHERE protocol = ? LIMIT 1',
        [protocol],
      );
      if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
    }

    return null;
  }

  async function attachSplitters(historyId, splitterEntries) {
    for (const entry of splitterEntries) {
      await dataPool.query(
        `
          INSERT INTO massiva_history_splitters (
            massiva_history_id,
            splitter_code,
            splitter_label
          )
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE splitter_label = VALUES(splitter_label)
        `,
        [historyId, entry.code, entry.label],
      );
    }
  }

  async function registerOpenBatch(input) {
    await ensureReady();

    const splitterEntries = uniqueSplitterEntries(input?.splitterEntries);
    const results = Array.isArray(input?.results) ? input.results : [];
    const title = normalizeText(input?.title);
    const operatorEmail = normalizeText(input?.operatorEmail);
    const affectedClients = normalizeNonNegativeInt(input?.affectedClients, 0);
    const expectedCloseAt = normalizeDate(input?.expectedCloseAt);
    const eventIdentifiedAt = normalizeDate(input?.eventIdentifiedAt);
    const openedAt = normalizeDate(input?.openedAt) ?? new Date();
    const autoClosed = input?.autoClosedWithoutClients === true;
    const status = autoClosed ? 'encerrada' : 'aberta';
    const closeDescription =
      autoClosed
        ? normalizeNullableText(input?.closeDescription) ??
          'Encerrada automaticamente sem clientes mapeáveis.'
        : null;
    const closedAt = autoClosed ? normalizeDate(input?.closedAt) ?? new Date() : null;

    let insertedOrUpdated = 0;

    for (const result of results) {
      const protocol = normalizePositiveInt(result?.protocol);
      const assignmentId = normalizePositiveInt(result?.assignmentId);
      const accessPointCode = normalizeText(result?.accessPointCode);
      const titleForResult = normalizeText(result?.title) || title;
      const affectedClientsForResult = normalizeNonNegativeInt(
        result?.affectedClients,
        affectedClients,
      );

      if (protocol === null && assignmentId === null) continue;

      const existingId = await findExistingHistoryId(protocol, assignmentId);

      if (existingId !== null) {
        await dataPool.query(
          `
            UPDATE massiva_history
            SET
              protocol = COALESCE(?, protocol),
              assignment_id = COALESCE(?, assignment_id),
              access_point_code = CASE WHEN ? <> '' THEN ? ELSE access_point_code END,
              title = CASE WHEN ? <> '' THEN ? ELSE title END,
              operator_email = CASE WHEN ? <> '' THEN ? ELSE operator_email END,
              affected_clients = GREATEST(affected_clients, ?),
              status = ?,
              opened_at = COALESCE(opened_at, ?),
              event_identified_at = COALESCE(?, event_identified_at),
              expected_close_at = COALESCE(?, expected_close_at),
              closed_at = ?,
              auto_closed_without_clients = ?,
              close_description = COALESCE(?, close_description),
              source = 'nexaview-local'
            WHERE id = ?
          `,
          [
            protocol,
            assignmentId,
            accessPointCode,
            accessPointCode,
            titleForResult,
            titleForResult,
            operatorEmail,
            operatorEmail,
            affectedClientsForResult,
            status,
            openedAt,
            eventIdentifiedAt,
            expectedCloseAt,
            closedAt,
            autoClosed ? 1 : 0,
            closeDescription,
            existingId,
          ],
        );
        await attachSplitters(existingId, splitterEntries);
      } else {
        const [insertResult] = await dataPool.query(
          `
            INSERT INTO massiva_history (
              protocol,
              assignment_id,
              access_point_code,
              title,
              operator_email,
              affected_clients,
              status,
              opened_at,
              event_identified_at,
              expected_close_at,
              closed_at,
              auto_closed_without_clients,
              close_description,
              source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nexaview-local')
          `,
          [
            protocol,
            assignmentId,
            accessPointCode,
            titleForResult,
            operatorEmail,
            affectedClientsForResult,
            status,
            openedAt,
            eventIdentifiedAt,
            expectedCloseAt,
            closedAt,
            autoClosed ? 1 : 0,
            closeDescription,
          ],
        );
        await attachSplitters(insertResult.insertId, splitterEntries);
      }

      insertedOrUpdated += 1;
    }

    return { configured: true, insertedOrUpdated };
  }

  async function registerClose(input) {
    await ensureReady();

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const closeDescription = normalizeNullableText(input?.closeDescription);
    const closedAt = normalizeDate(input?.closedAt) ?? new Date();

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, updated: 0 };
    }

    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          status = 'encerrada',
          closed_at = ?,
          close_description = COALESCE(?, close_description),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [closedAt, closeDescription, existingId],
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  async function getSplitterStats(splitterCodes) {
    await ensureReady();

    const normalizedCodes = [...new Set(
      (Array.isArray(splitterCodes) ? splitterCodes : [])
        .map((code) => normalizeText(code))
        .filter((code) => code !== ''),
    )];

    if (normalizedCodes.length === 0) return new Map();

    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const [rows] = await dataPool.query(
      `
        SELECT
          hs.splitter_code AS splitterCode,
          COUNT(DISTINCT h.id) AS totalTickets,
          SUM(CASE WHEN h.status = 'aberta' THEN 1 ELSE 0 END) AS openTickets,
          SUM(CASE WHEN h.status = 'encerrada' THEN 1 ELSE 0 END) AS closedTickets,
          COALESCE(SUM(h.affected_clients), 0) AS affectedClientsTotal,
          MAX(h.opened_at) AS latestOpenedAt
        FROM massiva_history_splitters hs
        INNER JOIN massiva_history h
          ON h.id = hs.massiva_history_id
        WHERE hs.splitter_code IN (${placeholders})
        GROUP BY hs.splitter_code
      `,
      normalizedCodes,
    );

    const byCode = new Map();
    for (const row of rows) {
      byCode.set(String(row.splitterCode), {
        totalTickets: Number(row.totalTickets ?? 0),
        openTickets: Number(row.openTickets ?? 0),
        closedTickets: Number(row.closedTickets ?? 0),
        affectedClientsTotal: Number(row.affectedClientsTotal ?? 0),
        latestOpenedAt:
          row.latestOpenedAt instanceof Date
            ? row.latestOpenedAt.toISOString()
            : row.latestOpenedAt
              ? new Date(row.latestOpenedAt).toISOString()
              : null,
      });
    }

    return byCode;
  }

  async function getOpenSplitterCodes() {
    await ensureReady();

    const [rows] = await dataPool.query(
      `
        SELECT DISTINCT hs.splitter_code AS splitterCode
        FROM massiva_history_splitters hs
        INNER JOIN massiva_history h
          ON h.id = hs.massiva_history_id
        WHERE h.status = 'aberta'
        ORDER BY hs.splitter_code ASC
      `,
    );

    return rows
      .map((row) => String(row.splitterCode ?? '').trim())
      .filter((code) => code !== '');
  }

  async function upsertSplitterSnapshots(snapshots) {
    await ensureReady();

    const clean = (Array.isArray(snapshots) ? snapshots : [])
      .map((snapshot) => {
        const splitterCode = normalizeText(snapshot?.splitterCode);
        if (splitterCode === '') return null;

        const capturedAt = normalizeDate(snapshot?.capturedAt) ?? new Date();
        const capturedDay = capturedAt.toISOString().slice(0, 10);
        const outPorts = normalizeNonNegativeInt(snapshot?.outPorts, 0);
        const busyCount = normalizeNonNegativeInt(snapshot?.busyCount, 0);
        const usagePercentRaw =
          snapshot?.usagePercent ??
          (outPorts > 0 ? (busyCount / outPorts) * 100 : 0);
        const usagePercent = Number(
          Math.max(0, Math.min(1000, Number(usagePercentRaw ?? 0))).toFixed(2),
        );

        return {
          splitterCode,
          splitterTitle: normalizeText(snapshot?.splitterTitle),
          accessPointCode: normalizeText(snapshot?.accessPointCode),
          capturedDay,
          capturedAt,
          active: snapshot?.active === true ? 1 : 0,
          outPorts,
          busyCount,
          usagePercent,
          city: normalizeNullableText(snapshot?.city),
          street: normalizeNullableText(snapshot?.street),
          tipoLocal: normalizeNullableText(snapshot?.tipoLocal),
          nomeCondominio: normalizeNullableText(snapshot?.nomeCondominio),
          massivaOpenCount: normalizeNonNegativeInt(snapshot?.massivaOpenCount, 0),
          massivaTotalCount: normalizeNonNegativeInt(snapshot?.massivaTotalCount, 0),
        };
      })
      .filter(Boolean);

    if (clean.length === 0) {
      return { configured: true, insertedOrUpdated: 0, skippedUnchanged: 0 };
    }

    const placeholders = clean.map(() => '?').join(', ');
    const [latestRows] = await dataPool.query(
      `
        SELECT
          s.splitter_code AS splitterCode,
          s.active AS active,
          s.out_ports AS outPorts,
          s.busy_count AS busyCount,
          s.usage_percent AS usagePercent,
          s.access_point_code AS accessPointCode,
          s.city AS city,
          s.street AS street,
          s.tipo_local AS tipoLocal,
          s.nome_condominio AS nomeCondominio,
          s.massiva_open_count AS massivaOpenCount,
          s.massiva_total_count AS massivaTotalCount
        FROM splitter_snapshots s
        INNER JOIN (
          SELECT splitter_code, MAX(captured_at) AS maxCapturedAt
          FROM splitter_snapshots
          WHERE splitter_code IN (${placeholders})
          GROUP BY splitter_code
        ) latest
          ON latest.splitter_code = s.splitter_code
         AND latest.maxCapturedAt = s.captured_at
      `,
      clean.map((row) => row.splitterCode),
    );

    const latestByCode = new Map();
    for (const latestRow of latestRows) {
      latestByCode.set(String(latestRow.splitterCode), {
        active: Number(latestRow.active ?? 0),
        outPorts: Number(latestRow.outPorts ?? 0),
        busyCount: Number(latestRow.busyCount ?? 0),
        usagePercent: Number(latestRow.usagePercent ?? 0),
        accessPointCode: normalizeText(latestRow.accessPointCode),
        city: normalizeNullableText(latestRow.city),
        street: normalizeNullableText(latestRow.street),
        tipoLocal: normalizeNullableText(latestRow.tipoLocal),
        nomeCondominio: normalizeNullableText(latestRow.nomeCondominio),
        massivaOpenCount: Number(latestRow.massivaOpenCount ?? 0),
        massivaTotalCount: Number(latestRow.massivaTotalCount ?? 0),
      });
    }

    let insertedOrUpdated = 0;
    let skippedUnchanged = 0;

    for (const row of clean) {
      const previous = latestByCode.get(row.splitterCode);
      const unchanged =
        previous != null &&
        previous.active === row.active &&
        previous.outPorts === row.outPorts &&
        previous.busyCount === row.busyCount &&
        Number(previous.usagePercent.toFixed(2)) === Number(row.usagePercent.toFixed(2)) &&
        previous.accessPointCode === row.accessPointCode &&
        previous.city === row.city &&
        previous.street === row.street &&
        previous.tipoLocal === row.tipoLocal &&
        previous.nomeCondominio === row.nomeCondominio &&
        previous.massivaOpenCount === row.massivaOpenCount &&
        previous.massivaTotalCount === row.massivaTotalCount;

      if (unchanged) {
        skippedUnchanged += 1;
        continue;
      }

      await dataPool.query(
        `
          INSERT INTO splitter_snapshots (
            splitter_code,
            splitter_title,
            access_point_code,
            captured_day,
            captured_at,
            active,
            out_ports,
            busy_count,
            usage_percent,
            city,
            street,
            tipo_local,
            nome_condominio,
            massiva_open_count,
            massiva_total_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            splitter_title = VALUES(splitter_title),
            access_point_code = VALUES(access_point_code),
            captured_at = VALUES(captured_at),
            active = VALUES(active),
            out_ports = VALUES(out_ports),
            busy_count = VALUES(busy_count),
            usage_percent = VALUES(usage_percent),
            city = VALUES(city),
            street = VALUES(street),
            tipo_local = VALUES(tipo_local),
            nome_condominio = VALUES(nome_condominio),
            massiva_open_count = VALUES(massiva_open_count),
            massiva_total_count = VALUES(massiva_total_count)
        `,
        [
          row.splitterCode,
          row.splitterTitle,
          row.accessPointCode,
          row.capturedDay,
          row.capturedAt,
          row.active,
          row.outPorts,
          row.busyCount,
          row.usagePercent,
          row.city,
          row.street,
          row.tipoLocal,
          row.nomeCondominio,
          row.massivaOpenCount,
          row.massivaTotalCount,
        ],
      );
      insertedOrUpdated += 1;
    }

    return { configured: true, insertedOrUpdated, skippedUnchanged };
  }

  function buildTrendLabel(currentUsagePercent, delta7d, delta30d) {
    if (currentUsagePercent >= 85 && delta30d >= 5) return 'Quase saturando';
    if (delta30d >= 5 || delta7d >= 3) return 'Em crescimento';
    if (delta30d <= -5 || delta7d <= -3) return 'Em queda';
    return 'Estavel';
  }

  async function getSplitterTrends(splitterCodes) {
    await ensureReady();

    const normalizedCodes = [...new Set(
      (Array.isArray(splitterCodes) ? splitterCodes : [])
        .map((code) => normalizeText(code))
        .filter((code) => code !== ''),
    )];

    if (normalizedCodes.length === 0) return new Map();

    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const [rows] = await dataPool.query(
      `
        SELECT
          splitter_code AS splitterCode,
          captured_day AS capturedDay,
          captured_at AS capturedAt,
          busy_count AS busyCount,
          out_ports AS outPorts,
          usage_percent AS usagePercent
        FROM splitter_snapshots
        WHERE splitter_code IN (${placeholders})
        ORDER BY splitter_code ASC, captured_at DESC
      `,
      normalizedCodes,
    );

    const grouped = new Map();
    for (const row of rows) {
      const code = String(row.splitterCode ?? '').trim();
      if (code === '') continue;
      if (!grouped.has(code)) grouped.set(code, []);
      grouped.get(code).push({
        capturedAt: row.capturedAt instanceof Date ? row.capturedAt : new Date(row.capturedAt),
        busyCount: Number(row.busyCount ?? 0),
        outPorts: Number(row.outPorts ?? 0),
        usagePercent: Number(row.usagePercent ?? 0),
      });
    }

    const now = new Date();
    const cutoff7d = new Date(now);
    cutoff7d.setDate(cutoff7d.getDate() - 7);
    const cutoff30d = new Date(now);
    cutoff30d.setDate(cutoff30d.getDate() - 30);

    const trends = new Map();
    for (const code of normalizedCodes) {
      const snapshots = grouped.get(code) ?? [];
      const current = snapshots[0] ?? null;
      const baseline7d =
        snapshots.find((snapshot) => snapshot.capturedAt <= cutoff7d) ??
        snapshots[snapshots.length - 1] ??
        null;
      const baseline30d =
        snapshots.find((snapshot) => snapshot.capturedAt <= cutoff30d) ??
        snapshots[snapshots.length - 1] ??
        null;

      const currentUsagePercent = current?.usagePercent ?? 0;
      const delta7d = current && baseline7d
        ? Number((currentUsagePercent - baseline7d.usagePercent).toFixed(2))
        : 0;
      const delta30d = current && baseline30d
        ? Number((currentUsagePercent - baseline30d.usagePercent).toFixed(2))
        : 0;

      trends.set(code, {
        label: buildTrendLabel(currentUsagePercent, delta7d, delta30d),
        currentUsagePercent,
        delta7d,
        delta30d,
        capturedAt: current?.capturedAt ? current.capturedAt.toISOString() : null,
      });
    }

    return trends;
  }

  /** Agregado de massivas abertas (mesma fonte do snapshot diário do dashboard). */
  async function getOpenMassivaDashboardKpis() {
    await ensureReady();
    const [rows] = await dataPool.query(
      `SELECT COUNT(*) AS open_count, COALESCE(SUM(affected_clients), 0) AS affected_sum
       FROM massiva_history
       WHERE status = 'aberta'`,
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return {
      openMassivas: row ? Number(row.open_count ?? 0) : 0,
      affectedClientsOpen: row ? Number(row.affected_sum ?? 0) : 0,
    };
  }

  async function getHistoryList(input = {}) {
    await ensureReady();

    const statusRaw = normalizeText(input?.status).toLowerCase();
    const status = statusRaw === 'aberta' || statusRaw === 'encerrada' ? statusRaw : null;
    const startDate = normalizeDate(input?.startDate);
    const endDate = normalizeDate(input?.endDate);
    const limit = Math.min(10000, Math.max(1, normalizePositiveInt(input?.limit) ?? 3000));

    const where = [];
    const values = [];
    if (status !== null) {
      where.push('h.status = ?');
      values.push(status);
    }
    if (startDate !== null) {
      where.push('h.opened_at >= ?');
      values.push(startDate);
    }
    if (endDate !== null) {
      where.push('h.opened_at <= ?');
      values.push(endDate);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await dataPool.query(
      `
        SELECT
          h.id AS id,
          h.protocol AS protocol,
          h.assignment_id AS assignmentId,
          h.access_point_code AS accessPointCode,
          h.title AS title,
          h.operator_email AS operatorEmail,
          h.affected_clients AS affectedClients,
          h.status AS status,
          h.opened_at AS openedAt,
          h.event_identified_at AS eventIdentifiedAt,
          h.expected_close_at AS expectedCloseAt,
          h.closed_at AS closedAt,
          h.updated_at AS updatedAt
        FROM massiva_history h
        ${whereSql}
        ORDER BY h.opened_at DESC, h.id DESC
        LIMIT ?
      `,
      [...values, limit],
    );

    return rows.map((row) => ({
      id: Number(row.id ?? 0),
      protocol: row.protocol == null ? null : Number(row.protocol),
      assignmentId: row.assignmentId == null ? null : Number(row.assignmentId),
      accessPointCode: normalizeText(row.accessPointCode),
      title: normalizeText(row.title),
      operatorEmail: normalizeText(row.operatorEmail),
      affectedClients: Number(row.affectedClients ?? 0),
      status: normalizeText(row.status).toLowerCase() === 'encerrada' ? 'encerrada' : 'aberta',
      openedAt: row.openedAt instanceof Date ? row.openedAt : normalizeDate(row.openedAt),
      eventIdentifiedAt:
        row.eventIdentifiedAt instanceof Date
          ? row.eventIdentifiedAt
          : normalizeDate(row.eventIdentifiedAt),
      expectedCloseAt:
        row.expectedCloseAt instanceof Date ? row.expectedCloseAt : normalizeDate(row.expectedCloseAt),
      closedAt: row.closedAt instanceof Date ? row.closedAt : normalizeDate(row.closedAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : normalizeDate(row.updatedAt),
    }));
  }

  async function end() {
    await dataPool.end();
  }

  return {
    configured: true,
    ensureReady,
    registerOpenBatch,
    registerClose,
    getSplitterStats,
    getOpenSplitterCodes,
    upsertSplitterSnapshots,
    getSplitterTrends,
    getOpenMassivaDashboardKpis,
    getHistoryList,
    end,
  };
}
