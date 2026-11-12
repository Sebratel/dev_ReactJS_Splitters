-- =====================================================================================================
-- Clientes que ficaram de fora de um evento (massiva ou GMUD) por ja estarem em outro evento aberto.
-- Banco: DB_Massives. Aditivo e idempotente (CREATE TABLE IF NOT EXISTS); nenhuma tabela existente muda.
--
-- Serve a dois fins: (1) historico do evento marcado "ja estava em outro evento" e (2) fila de reinclusao:
-- quando o outro evento fecha e este continua aberto, o cliente volta a ser sinalizado.
-- Pre-requisitos: assignment_clients.origin e gmud_client_sync/gmud_affected_clients ja criados.
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS event_suppressed_clients (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type          VARCHAR(10)  NOT NULL,              -- 'massiva' | 'gmud' (o evento que NAO recebeu o cliente)
  event_protocol      BIGINT UNSIGNED NOT NULL,
  assignment_id       BIGINT UNSIGNED NULL,
  contract_id         BIGINT UNSIGNED NOT NULL,
  pppoe               VARCHAR(100) NULL,
  corporate_client    TINYINT(1)   NOT NULL DEFAULT 0,
  blocked_by_protocol BIGINT UNSIGNED NULL,               -- evento onde o cliente ja estava (nulo = nao informado)
  blocked_by_type     VARCHAR(10)  NULL,                  -- 'massiva' | 'gmud'
  reason              TEXT         NULL,                  -- motivo que o cliente veria no evento
  finish_date         DATETIME     NULL,                  -- previsao de fim do evento (Brasilia)
  created_at          DATETIME     NOT NULL,
  reincluded_at       DATETIME     NULL,
  resolved_at         DATETIME     NULL,
  resolved_reason     VARCHAR(40)  NULL,                  -- 'evento_encerrado' | ...
  PRIMARY KEY (id),
  UNIQUE KEY uq_esc_event_contract (event_type, event_protocol, contract_id),
  KEY idx_esc_pending (reincluded_at, resolved_at),
  KEY idx_esc_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ROLLBACK (perde o historico de exclusoes): DROP TABLE event_suppressed_clients;
