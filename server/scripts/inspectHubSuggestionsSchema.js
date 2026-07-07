import mysql from 'mysql2/promise';
import { resolveMysqlConfig, toCleanString } from '../lib/platformSuggestionsSync.js';

const source = resolveMysqlConfig('HUB_APPS_MYSQL', 'MASSIVA_MYSQL');
if (!toCleanString(process.env.HUB_APPS_MYSQL_DATABASE)) {
  source.database = 'DB_Hub_Apps';
}

const pool = mysql.createPool({ ...source, connectionLimit: 2, charset: 'utf8mb4' });

try {
  const [cols] = await pool.query('SHOW COLUMNS FROM platform_suggestions');
  const fields = cols.map((c) => c.Field);
  console.log('columns:', fields.join(', '));

  const appCol = cols.find((c) => /app/i.test(c.Field));
  if (!appCol) {
    const [total] = await pool.query('SELECT COUNT(*) AS total FROM platform_suggestions');
    console.log('total_rows:', total[0]?.total ?? 0);
    const [sample] = await pool.query(
      'SELECT id, title, sector, category FROM platform_suggestions ORDER BY id DESC LIMIT 5',
    );
    console.log('sample:', JSON.stringify(sample, null, 2));
    process.exit(0);
  }

  const field = appCol.Field;
  const [counts] = await pool.query(
    `SELECT ${field} AS app_id, COUNT(*) AS total FROM platform_suggestions GROUP BY ${field} ORDER BY total DESC`,
  );
  console.log('counts_by_app:', JSON.stringify(counts, null, 2));

  const [splitters] = await pool.query(
    `SELECT COUNT(*) AS total FROM platform_suggestions WHERE ${field} = ?`,
    ['app-splitters-sebratel'],
  );
  console.log('app-splitters-sebratel_count:', splitters[0]?.total ?? 0);
} catch (error) {
  console.error('error:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
