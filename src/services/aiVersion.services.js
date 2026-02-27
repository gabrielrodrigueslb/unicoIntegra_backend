import { prisma } from '../../prisma/PrismaClient.js';
import { adminPool } from '../database/adminPool.js';

const MAX_VERSION_RETRIES = 3;
let aiVersionsTableReady = false;
let aiVersionsTableInitPromise = null;

export async function ensureAiVersionsTableExists() {
  if (aiVersionsTableReady) return;
  if (aiVersionsTableInitPromise) {
    await aiVersionsTableInitPromise;
    return;
  }

  aiVersionsTableInitPromise = (async () => {
    try {
      await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);

      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS sistema.ai_versions (
          id SERIAL PRIMARY KEY,
          instance VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          payload JSONB NOT NULL,
          "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await adminPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ai_versions_instance_version_key
        ON sistema.ai_versions ("instance", "version");
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_versions_instance_idx
        ON sistema.ai_versions ("instance");
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_versions_createdAt_idx
        ON sistema.ai_versions ("createdAt");
      `);

      aiVersionsTableReady = true;
    } catch (error) {
      // Se a tabela já existe mas pertence a outro usuário, a criação de índice falha com 42501.
      // Nesse caso, apenas seguimos usando a tabela existente.
      if (error?.code === '42501') {
        const check = await adminPool.query(`
          SELECT to_regclass('sistema.ai_versions') AS table_name;
        `);

        if (check.rows?.[0]?.table_name) {
          console.warn(
            'AI_VERSION WARN: Sem permissão de ownership para alterar índices de sistema.ai_versions. Usando tabela existente.',
          );
          aiVersionsTableReady = true;
          return;
        }
      }

      throw error;
    }
  })();

  try {
    await aiVersionsTableInitPromise;
  } finally {
    aiVersionsTableInitPromise = null;
  }
}

export async function createAiVersionSnapshot(instance, payload) {
  await ensureAiVersionsTableExists();

  if (!instance) {
    throw new Error('Instância é obrigatória para versionar a IA.');
  }

  for (let attempt = 1; attempt <= MAX_VERSION_RETRIES; attempt += 1) {
    try {
      const snapshot = await prisma.$transaction(async (tx) => {
        const aggregate = await tx.aiVersion.aggregate({
          where: { instance },
          _max: { version: true },
        });

        const nextVersion = (aggregate._max.version ?? 0) + 1;

        return tx.aiVersion.create({
          data: {
            instance,
            version: nextVersion,
            payload,
          },
        });
      });

      return snapshot;
    } catch (error) {
      if (error?.code === 'P2002' && attempt < MAX_VERSION_RETRIES) {
        continue;
      }

      console.error('SERVICE ERROR: Falha ao versionar payload da IA:', error);
      throw error;
    }
  }
}

function parseBooleanFlag(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}

function buildAiVersionKey(item) {
  if (item.aiId !== null && item.aiId !== undefined) {
    return `${item.instance}::id::${item.aiId}`;
  }

  const fallbackName = item.signaturename || item.name || 'sem-identificador';
  return `${item.instance}::name::${fallbackName}`;
}

export async function listAiVersions({
  limit = 200,
  latestOnly = true,
  instance,
} = {}) {
  await ensureAiVersionsTableExists();

  const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const useLatestOnly = parseBooleanFlag(latestOnly, true);
  const normalizedInstance =
    typeof instance === 'string' && instance.trim() ? instance.trim() : null;
  const where = normalizedInstance ? { instance: normalizedInstance } : undefined;
  const prismaTake = useLatestOnly
    ? Math.min(Math.max(parsedLimit * 10, parsedLimit), 5000)
    : parsedLimit;

  const rows = await prisma.aiVersion.findMany({
    where,
    take: prismaTake,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const normalizedRows = rows.map((row) => {
    const payload =
      row.payload && typeof row.payload === 'object' ? row.payload : {};

    return {
      id: row.id,
      instance: row.instance,
      version: row.version,
      createdAt: row.createdAt,
      aiId: payload.id ?? null,
      name: payload.name ?? null,
      signaturename: payload.signaturename ?? null,
      description: payload.description ?? null,
      payload,
    };
  });

  if (!useLatestOnly) {
    return normalizedRows.slice(0, parsedLimit);
  }

  const seen = new Set();
  const latestRows = [];

  for (const item of normalizedRows) {
    const key = buildAiVersionKey(item);
    if (seen.has(key)) continue;

    seen.add(key);
    latestRows.push(item);

    if (latestRows.length >= parsedLimit) break;
  }

  return latestRows;
}
