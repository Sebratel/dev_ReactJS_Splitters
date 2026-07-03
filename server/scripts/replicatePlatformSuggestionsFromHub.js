/**
 * Replica sugestoes do Hub Apps (fonte da verdade) para bancos consumidores.
 *
 * Fluxo: DB_Hub_Apps → DB_Massives (Splitters) ou outro destino via SUGGESTIONS_REPLICA_MYSQL_*.
 *
 * Uso:
 *   node server/scripts/replicatePlatformSuggestionsFromHub.js
 *   node server/scripts/replicatePlatformSuggestionsFromHub.js --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SUGGESTIONS_TABLES,
  assertMysqlConfig,
  countTableRows,
  createMysqlPool,
  replicatePlatformSuggestions,
  resolveMysqlConfig,
  toCleanString,
} from '../lib/platformSuggestionsSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: true });

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const source = resolveMysqlConfig('HUB_APPS_MYSQL', 'MASSIVA_MYSQL');
  if (!toCleanString(process.env.HUB_APPS_MYSQL_DATABASE)) {
    source.database = 'DB_Hub_Apps';
  }

  const replicaDatabase = toCleanString(process.env.SUGGESTIONS_REPLICA_MYSQL_DATABASE);
  const target = replicaDatabase
    ? resolveMysqlConfig('SUGGESTIONS_REPLICA_MYSQL', 'MASSIVA_MYSQL')
    : resolveMysqlConfig('MASSIVA_MYSQL');

  assertMysqlConfig('Fonte (HUB_APPS_MYSQL)', source);
  assertMysqlConfig('Replica (SUGGESTIONS_REPLICA_MYSQL ou MASSIVA_MYSQL)', target);

  console.log(`Fonte (Hub Apps): ${source.user}@${source.host}:${source.port}/${source.database}`);
  console.log(`Replica (app):    ${target.user}@${target.host}:${target.port}/${target.database}`);
  if (dryRun) console.log('Modo: dry-run');

  const sourcePool = await createMysqlPool(source);
  const targetPool = dryRun ? null : await createMysqlPool(target);

  try {
    console.log('\nContagem na fonte (Hub Apps):');
    for (const table of SUGGESTIONS_TABLES) {
      console.log(`  ${table}: ${await countTableRows(sourcePool, table)}`);
    }

    const results = await replicatePlatformSuggestions({
      sourcePool,
      targetPool,
      dryRun,
    });

    console.log('\nReplicacao:');
    for (const table of SUGGESTIONS_TABLES) {
      const r = results[table];
      console.log(`  ${table}: origem=${r.source}, copiadas=${r.copied}, destino=${r.target}`);
    }

    if (!dryRun) {
      let ok = true;
      console.log('\nVerificacao:');
      for (const table of SUGGESTIONS_TABLES) {
        const sourceCount = await countTableRows(sourcePool, table);
        const targetCount = await countTableRows(targetPool, table);
        const match = sourceCount === targetCount;
        if (!match) ok = false;
        console.log(`  ${table}: hub=${sourceCount}, replica=${targetCount} ${match ? 'OK' : 'DIVERGENTE'}`);
      }
      if (!ok) process.exitCode = 1;
      else console.log('\nReplica sincronizada com o Hub Apps.');
    }
  } finally {
    await sourcePool.end();
    if (targetPool) await targetPool.end();
  }
}

main().catch((error) => {
  console.error('Falha na replicacao:', error?.message ?? error);
  process.exitCode = 1;
});
