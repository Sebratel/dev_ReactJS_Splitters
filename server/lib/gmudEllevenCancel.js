/**
 * Cancela o protocolo da GMUD no Elleven pelo gateway, sem usuário logado.
 *
 * Usado quando uma área nega a GMUD por link: quem clicou não tem sessão, então a chamada usa a
 * credencial Basic do gateway (a mesma que o nginx do frontend já usa). O gateway só usa o JWT do
 * usuário para registrar nome/e-mail em log, não para autorizar o encerramento.
 *
 * Config (env do backend): GATEWAY_ORIGIN, GATEWAY_BASIC_AUTH_USER, GATEWAY_BASIC_AUTH_PASSWORD.
 * Sem elas, devolve { skipped: true } e a GMUD fica negada na plataforma para o Comitê cancelar.
 */

const CANCEL_PATH = '/api/v1/gmud/encerrar-via-api';

function fmtDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function buildAreaDenialDescription({ areaLabel, byName, at = new Date() }) {
  const quem = String(byName ?? '').trim() || 'responsável da área';
  return `GMUD não aprovada pela área ${areaLabel} (${quem}) — encerrada via plataforma em ${fmtDate(at)}.`;
}

export async function cancelGmudInElleven({ assignmentId, description }, { env = process.env, fetchImpl = fetch } = {}) {
  const origin = String(env.GATEWAY_ORIGIN ?? '').trim().replace(/\/+$/, '');
  const user = String(env.GATEWAY_BASIC_AUTH_USER ?? '').trim();
  const password = String(env.GATEWAY_BASIC_AUTH_PASSWORD ?? '');
  if (origin === '' || user === '' || password === '') {
    return { ok: false, skipped: true, reason: 'Gateway não configurado no backend (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).' };
  }
  if (!Number.isFinite(Number(assignmentId)) || Number(assignmentId) <= 0) {
    return { ok: false, skipped: true, reason: 'GMUD sem assignmentId registrado; cancelamento no Elleven não pôde ser feito.' };
  }

  const body = {
    assignmentId: String(assignmentId),
    incidentStatusId: String(env.GMUD_CANCEL_INCIDENT_STATUS_ID || '8'),
    description,
    progress: '0',
    priority: '35',
    notificationTarget: '0',
    privateReport: 'true',
  };

  try {
    const response = await fetchImpl(`${origin}${CANCEL_PATH}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return { ok: false, reason: `Gateway recusou o cancelamento (HTTP ${response.status}).` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Falha ao chamar o gateway: ${error?.message ?? 'erro desconhecido'}` };
  }
}
