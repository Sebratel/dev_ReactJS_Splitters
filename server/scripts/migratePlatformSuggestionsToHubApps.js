/**
 * Bootstrap legado (uma vez): copia sugestoes de DB_Massives para DB_Hub_Apps.
 * Arquitetura atual: Hub Apps e a fonte da verdade; use replicatePlatformSuggestionsFromHub.js
 * para replicar hub -> apps consumidores (Splitters, etc.).
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
  const source = resolveMysqlConfig('MASSIVA_MYSQL');
  const target = resolveMysqlConfig('HUB_APPS_MYSQL', 'MASSIVA_MYSQL');
  if (!toCleanString(process.env.HUB_APPS_MYSQL_DATABASE)) {
    target.database = 'DB_Hub_Apps';
  }

  assertMysqlConfig('Origem (MASSIVA_MYSQL)', source);
  assertMysqlConfig('Destino (HUB_APPS_MYSQL)', target);

  console.log(`Origem:  ${source.user}@${source.host}:${source.port}/${source.database}`);
  console.log(`Destino: ${target.user}@${target.host}:${target.port}/${target.database}`);
  if (dryRun) console.log('Modo: dry-run (sem escrita no destino)');

  const sourcePool = await createMysqlPool(source);
  const targetPool = dryRun ? null : await createMysqlPool(target);

  try {
    const results = await replicatePlatformSuggestions({
      sourcePool,
      targetPool,
      dryRun,
    });

    console.log('\nCopiando tabelas (ordem respeita FKs)...');
    for (const table of SUGGESTIONS_TABLES) {
      const r = results[table];
      console.log(`  ${table}: origem=${r.source}, copiadas=${r.copied}, destino=${r.target}`);
    }

    if (!dryRun) {
      console.log('\nVerificacao final no destino:');
      let ok = true;
      for (const table of SUGGESTIONS_TABLES) {
        const sourceCount = await countTableRows(sourcePool, table);
        const targetCount = await countTableRows(targetPool, table);
        const match = sourceCount === targetCount;
        if (!match) ok = false;
        console.log(`  ${table}: origem=${sourceCount}, destino=${targetCount} ${match ? 'OK' : 'DIVERGENTE'}`);
      }
      if (!ok) {
        process.exitCode = 1;
        console.error('\nMigracao concluida com divergencias — revise os logs.');
      } else {
        console.log('\nMigracao concluida: 100% dos registros copiados.');
      }
    }
  } finally {
    await sourcePool.end();
    if (targetPool) await targetPool.end();
  }
}

main().catch((error) => {
  console.error('Falha na migracao:', error?.message ?? error);
  process.exitCode = 1;
});
