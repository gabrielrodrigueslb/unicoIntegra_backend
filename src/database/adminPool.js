import { Pool } from 'pg';

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildPoolConfig() {
  const connectionString = normalizeOptionalString(process.env.DATABASE_URL);
  if (connectionString) {
    return {
      connectionString,
    };
  }

  return {
    host: normalizeOptionalString(process.env.DBHOST),
    user: normalizeOptionalString(process.env.DBUSER),
    password: normalizeOptionalString(process.env.DBPASSWORD),
    database: normalizeOptionalString(process.env.DB_DATABASE) || 'unico_integra',
    port: Number(process.env.DBPORT) || 5432,
  };
}

export const adminPool = new Pool(buildPoolConfig());
