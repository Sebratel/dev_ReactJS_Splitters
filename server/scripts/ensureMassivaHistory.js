import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMassivaHistoryStore } from '../massivaHistoryStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });

const store = createMassivaHistoryStore({
  host: process.env.MASSIVA_MYSQL_HOST,
  port: process.env.MASSIVA_MYSQL_PORT,
  user: process.env.MASSIVA_MYSQL_USER,
  password: process.env.MASSIVA_MYSQL_PASSWORD,
  database: process.env.MASSIVA_MYSQL_DATABASE,
});

try {
  if (!store.configured) {
    throw new Error('Credenciais MySQL de histórico de massivas não configuradas.');
  }
  await store.ensureReady();
  console.log('Tabelas de histórico de massivas garantidas com sucesso.');
} finally {
  await store.end();
}
