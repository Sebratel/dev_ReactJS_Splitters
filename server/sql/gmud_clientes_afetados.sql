-- =====================================================================================================
-- Clientes da GMUD: estado da sincronizacao + historico permanente (nunca apagado)
-- Banco: DB_Massives (MySQL/MariaDB do app Splitters)
--
-- Pre-requisito: assignment_clients.origin (gateway/docs/sql/assignment_clients_origin.sql) ja aplicado.
-- Aditivo e idempotente (CREATE TABLE IF NOT EXISTS). Nenhuma tabela existente e alterada.
-- =====================================================================================================

-- Uma linha por GMUD: estaria "incluida" (clientes em assignment_clients) ou "removida".
CREATE TABLE IF NOT EXISTS gmud_client_sync (
  gmud_protocol   BIGINT UNSIGNED NOT NULL,
  status          VARCHAR(12)  NOT NULL,                 -- 'incluida' | 'removida'
  window_end      DATETIME     NULL,                      -- previsao de fim enviada (horario de Brasilia)
  clients_total   INT          NOT NULL DEFAULT 0,        -- clientes do escopo
  clients_sent    INT          NOT NULL DEFAULT 0,        -- gravados em assignment_clients
  clients_skipped INT          NOT NULL DEFAULT 0,        -- ja estavam em outro evento aberto
  included_at     DATETIME     NULL,
  removed_at      DATETIME     NULL,
  removed_reason  VARCHAR(40)  NULL,
  last_error      VARCHAR(500) NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gmud_protocol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historico de quem foi sinalizado por cada GMUD (separado de massiva_affected_clients).
-- Alimenta os indicadores: quantas GMUDs cada cliente participou, corporativos, etc.
CREATE TABLE IF NOT EXISTS gmud_affected_clients (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gmud_protocol    BIGINT UNSIGNED NOT NULL,
  contract_id      BIGINT UNSIGNED NOT NULL,
  pppoe            VARCHAR(100) NULL,
  corporate_client TINYINT(1)   NOT NULL DEFAULT 0,
  status           VARCHAR(24)  NOT NULL,                 -- 'incluido' | 'ja_em_outro_evento'
  included_at      DATETIME     NOT NULL,
  removed_at       DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_gmud_affected_gmud (gmud_protocol),
  KEY idx_gmud_affected_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ROLLBACK (so se necessario; perde o historico das GMUDs):
-- DROP TABLE gmud_affected_clients;
-- DROP TABLE gmud_client_sync;
