/**
 * Paridade com `buildSplitterOperationalScore` no frontend (TypeScript).
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {{ busyCount: number, outPorts: number }} splitter
 * @param {{ totalTickets: number, openTickets: number, affectedClientsTotal: number }} massivaStats
 */
export function buildSplitterOperationalScore(splitter, massivaStats) {
  const usagePercent =
    splitter.outPorts > 0 ? (splitter.busyCount / splitter.outPorts) * 100 : 0;

  const occupancyPoints = clamp(usagePercent * 0.45, 0, 45);
  const recurrencePoints = clamp(massivaStats.totalTickets * 5, 0, 20);
  const impactPoints = clamp(
    Math.log10(Math.max(1, massivaStats.affectedClientsTotal + 1)) * 8,
    0,
    15,
  );
  const openIncidentPoints = massivaStats.openTickets > 0 ? 20 : 0;

  const score = Math.round(
    clamp(
      occupancyPoints + recurrencePoints + impactPoints + openIncidentPoints,
      0,
      100,
    ),
  );

  if (score >= 70) {
    return { score, tone: 'critical', label: 'Crítico' };
  }
  if (score >= 40) {
    return { score, tone: 'attention', label: 'Atenção' };
  }
  return { score, tone: 'ok', label: 'Estável' };
}

export function compareRiskEntries(a, b) {
  if (b.operationalScore.score !== a.operationalScore.score) {
    return b.operationalScore.score - a.operationalScore.score;
  }
  if (b.massivaStats.openTickets !== a.massivaStats.openTickets) {
    return b.massivaStats.openTickets - a.massivaStats.openTickets;
  }
  if (b.massivaStats.affectedClientsTotal !== a.massivaStats.affectedClientsTotal) {
    return b.massivaStats.affectedClientsTotal - a.massivaStats.affectedClientsTotal;
  }
  const occA =
    a.splitter.outPorts > 0 ? a.splitter.busyCount / a.splitter.outPorts : 0;
  const occB =
    b.splitter.outPorts > 0 ? b.splitter.busyCount / b.splitter.outPorts : 0;
  const occDelta = occB - occA;
  if (Math.abs(occDelta) > 0.000001) return occDelta;
  return String(a.splitter.code ?? '').localeCompare(String(b.splitter.code ?? ''), 'pt-BR');
}
