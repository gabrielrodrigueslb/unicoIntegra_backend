import { adminPool } from '../database/adminPool.js';
import {
  MANAGED_AI_COMPONENT_KEYS,
  isManagedAiManualUpdateOnlyComponentKey,
  canManagedAiInstallationBeUpdated,
  isManagedAiProvider,
  isAiProviderUpdateBlocked,
} from './aiProviderCatalog.js';
import { listCurrentAiProviderTemplatePackages } from './aiProviderTemplate.services.js';

let aiClientInstallationsTableReady = false;
let aiClientInstallationsInitPromise = null;

function normalizeId(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeJsonValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function parseRowJson(value) {
  if (!value) return null;

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeComponentVersions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const normalized = {};

  for (const componentKey of MANAGED_AI_COMPONENT_KEYS) {
    const numericValue = Number(value[componentKey]);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      normalized[componentKey] = numericValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function resolveInstalledComponentVersions(row, currentPackage = null) {
  const explicitVersions = normalizeComponentVersions(
    parseRowJson(row.installedComponentVersions),
  );

  if (explicitVersions) {
    return explicitVersions;
  }

  if (
    row.installedVersion !== null &&
    row.installedVersion !== undefined &&
    currentPackage?.componentVersions
  ) {
    return null;
  }

  return null;
}

function calculateComponentsNeedingUpdate(installedVersions, currentVersions) {
  if (!currentVersions) return [];
  if (!installedVersions) {
    return MANAGED_AI_COMPONENT_KEYS.filter(
      (componentKey) => !isManagedAiManualUpdateOnlyComponentKey(componentKey),
    );
  }

  return MANAGED_AI_COMPONENT_KEYS.filter((componentKey) => {
    if (isManagedAiManualUpdateOnlyComponentKey(componentKey)) {
      return false;
    }

    const currentVersion = Number(currentVersions[componentKey]);
    const installedVersion = Number(installedVersions[componentKey]);

    if (!Number.isFinite(currentVersion)) return false;
    if (!Number.isFinite(installedVersion)) return true;
    return currentVersion > installedVersion;
  });
}

function normalizeInstallationRow(row, currentPackagesByProvider = new Map()) {
  if (!row) return null;

  const currentPackage = currentPackagesByProvider.get(row.provider) ?? null;
  const currentVersion = currentPackage?.version ?? null;
  const configSnapshot = parseRowJson(row.configSnapshot);
  const installedComponentVersions = resolveInstalledComponentVersions(
    row,
    currentPackage,
  );
  const currentComponentVersions =
    normalizeComponentVersions(currentPackage?.componentVersions) || null;
  const componentsNeedingUpdate = calculateComponentsNeedingUpdate(
    installedComponentVersions,
    currentComponentVersions,
  );

  const normalized = {
    id: row.id,
    instance: row.instance,
    provider: row.provider,
    assistantId: normalizeId(row.assistantId),
    assistantName: row.assistantName || null,
    installedVersion:
      row.installedVersion === null || row.installedVersion === undefined
        ? null
        : Number(row.installedVersion),
    currentVersion,
    updateAvailable: componentsNeedingUpdate.length > 0,
    source: row.source || 'managed',
    configSnapshot,
    installedComponentVersions,
    currentComponentVersions,
    componentsNeedingUpdate,
    preProcessId: normalizeId(row.preProcessId),
    buscaProdutosId: normalizeId(row.buscaProdutosId),
    downloadImagemId: normalizeId(row.downloadImagemId),
    uraIaId: normalizeId(row.uraIaId),
    uraAbId: normalizeId(row.uraAbId),
    lastSyncStatus: row.lastSyncStatus || 'unknown',
    lastSyncError: row.lastSyncError || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  normalized.canUpdate =
    !isAiProviderUpdateBlocked(normalized.provider) &&
    isManagedAiProvider(normalized.provider) &&
    canManagedAiInstallationBeUpdated(normalized);

  return normalized;
}

async function getCurrentPackagesByProvider() {
  const packages = await listCurrentAiProviderTemplatePackages();
  return new Map(packages.map((item) => [item.provider, item]));
}

export async function ensureAiClientInstallationsTableExists() {
  if (aiClientInstallationsTableReady) return;
  if (aiClientInstallationsInitPromise) {
    await aiClientInstallationsInitPromise;
    return;
  }

  aiClientInstallationsInitPromise = (async () => {
    try {
      await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);

      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS sistema.ai_client_installations (
          id SERIAL PRIMARY KEY,
          instance VARCHAR(255) NOT NULL,
          provider VARCHAR(50) NOT NULL,
          "assistantId" VARCHAR(100),
          "assistantName" VARCHAR(255),
          "installedVersion" INTEGER,
          source VARCHAR(50) NOT NULL DEFAULT 'managed',
          "configSnapshot" JSONB,
          "installedComponentVersions" JSONB,
          "preProcessId" VARCHAR(100),
          "buscaProdutosId" VARCHAR(100),
          "downloadImagemId" VARCHAR(100),
          "uraIaId" VARCHAR(100),
          "uraAbId" VARCHAR(100),
          "lastSyncStatus" VARCHAR(50) NOT NULL DEFAULT 'installed',
          "lastSyncError" TEXT,
          "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await adminPool.query(`
        ALTER TABLE sistema.ai_client_installations
        ADD COLUMN IF NOT EXISTS "installedComponentVersions" JSONB;
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_client_installations_instance_idx
        ON sistema.ai_client_installations (instance);
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_client_installations_provider_idx
        ON sistema.ai_client_installations (provider);
      `);

      await adminPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ai_client_installations_instance_assistant_key
        ON sistema.ai_client_installations (instance, "assistantId");
      `);

      aiClientInstallationsTableReady = true;
    } catch (error) {
      if (error?.code === '42501') {
        const check = await adminPool.query(`
          SELECT to_regclass('sistema.ai_client_installations') AS table_name;
        `);

        if (check.rows?.[0]?.table_name) {
          console.warn(
            'AI_INSTALLATION WARN: Sem permissao de ownership. Usando tabela existente.',
          );
          aiClientInstallationsTableReady = true;
          return;
        }
      }

      throw error;
    }
  })();

  try {
    await aiClientInstallationsInitPromise;
  } finally {
    aiClientInstallationsInitPromise = null;
  }
}

export async function ensureAiClientInstallationsReady() {
  await ensureAiClientInstallationsTableExists();
}

export async function upsertAiClientInstallation(record = {}) {
  await ensureAiClientInstallationsReady();

  const payload = {
    instance: record.instance,
    provider: record.provider,
    assistantId: normalizeId(record.assistantId),
    assistantName: record.assistantName || null,
    installedVersion:
      record.installedVersion === null || record.installedVersion === undefined
        ? null
        : Number(record.installedVersion),
    source: record.source || 'managed',
    configSnapshot: normalizeJsonValue(record.configSnapshot),
    installedComponentVersions: normalizeComponentVersions(
      record.installedComponentVersions,
    ),
    preProcessId: normalizeId(record.preProcessId),
    buscaProdutosId: normalizeId(record.buscaProdutosId),
    downloadImagemId: normalizeId(record.downloadImagemId),
    uraIaId: normalizeId(record.uraIaId),
    uraAbId: normalizeId(record.uraAbId),
    lastSyncStatus: record.lastSyncStatus || 'installed',
    lastSyncError: record.lastSyncError || null,
  };

  if (!payload.instance) {
    throw new Error('Instancia e obrigatoria para salvar a instalacao da IA.');
  }

  if (!payload.provider) {
    throw new Error('Provider e obrigatorio para salvar a instalacao da IA.');
  }

  if (!payload.assistantId) {
    throw new Error('AssistantId e obrigatorio para salvar a instalacao da IA.');
  }

  const result = await adminPool.query(
    `
      INSERT INTO sistema.ai_client_installations (
        instance,
        provider,
        "assistantId",
        "assistantName",
        "installedVersion",
        source,
        "configSnapshot",
        "installedComponentVersions",
        "preProcessId",
        "buscaProdutosId",
        "downloadImagemId",
        "uraIaId",
        "uraAbId",
        "lastSyncStatus",
        "lastSyncError",
        "updatedAt"
      )
      VALUES (
        $1::varchar(255),
        $2::varchar(50),
        $3::varchar(100),
        $4::varchar(255),
        $5::int,
        $6::varchar(50),
        $7::jsonb,
        $8::jsonb,
        $9::varchar(100),
        $10::varchar(100),
        $11::varchar(100),
        $12::varchar(100),
        $13::varchar(100),
        $14::varchar(50),
        $15::text,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (instance, "assistantId")
      DO UPDATE SET
        provider = EXCLUDED.provider,
        "assistantName" = EXCLUDED."assistantName",
        "installedVersion" = EXCLUDED."installedVersion",
        source = EXCLUDED.source,
        "configSnapshot" = EXCLUDED."configSnapshot",
        "installedComponentVersions" = EXCLUDED."installedComponentVersions",
        "preProcessId" = EXCLUDED."preProcessId",
        "buscaProdutosId" = EXCLUDED."buscaProdutosId",
        "downloadImagemId" = EXCLUDED."downloadImagemId",
        "uraIaId" = EXCLUDED."uraIaId",
        "uraAbId" = EXCLUDED."uraAbId",
        "lastSyncStatus" = EXCLUDED."lastSyncStatus",
        "lastSyncError" = EXCLUDED."lastSyncError",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *;
    `,
    [
      payload.instance,
      payload.provider,
      payload.assistantId,
      payload.assistantName,
      payload.installedVersion,
      payload.source,
      JSON.stringify(payload.configSnapshot),
      JSON.stringify(payload.installedComponentVersions),
      payload.preProcessId,
      payload.buscaProdutosId,
      payload.downloadImagemId,
      payload.uraIaId,
      payload.uraAbId,
      payload.lastSyncStatus,
      payload.lastSyncError,
    ],
  );

  const currentPackagesByProvider = await getCurrentPackagesByProvider();
  return normalizeInstallationRow(result.rows?.[0] ?? null, currentPackagesByProvider);
}

export async function listAiClientInstallations({
  instance,
  provider,
  limit = 500,
} = {}) {
  await ensureAiClientInstallationsReady();

  const params = [];
  const clauses = [];

  if (typeof instance === 'string' && instance.trim()) {
    params.push(instance.trim());
    clauses.push(`instance = $${params.length}::varchar(255)`);
  }

  if (typeof provider === 'string' && provider.trim()) {
    params.push(provider.trim());
    clauses.push(`provider = $${params.length}::varchar(50)`);
  }

  params.push(Math.min(Math.max(Number(limit) || 200, 1), 5000));

  const query = `
    SELECT *
    FROM sistema.ai_client_installations
    ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY instance ASC, "updatedAt" DESC, id DESC
    LIMIT $${params.length}::int;
  `;

  const result = await adminPool.query(query, params);
  const currentPackagesByProvider = await getCurrentPackagesByProvider();

  return (result.rows ?? []).map((row) =>
    normalizeInstallationRow(row, currentPackagesByProvider),
  );
}

export async function getAiClientInstallationById(id) {
  await ensureAiClientInstallationsReady();

  const result = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_client_installations
      WHERE id = $1::int
      LIMIT 1;
    `,
    [Number(id)],
  );

  const currentPackagesByProvider = await getCurrentPackagesByProvider();
  return normalizeInstallationRow(result.rows?.[0] ?? null, currentPackagesByProvider);
}

export async function setAiClientInstallationSyncStatus(
  id,
  {
    installedVersion,
    installedComponentVersions,
    lastSyncStatus,
    lastSyncError = null,
  } = {},
) {
  await ensureAiClientInstallationsReady();

  const result = await adminPool.query(
    `
      UPDATE sistema.ai_client_installations
      SET
        "installedVersion" = COALESCE($2::int, "installedVersion"),
        "installedComponentVersions" = COALESCE($3::jsonb, "installedComponentVersions"),
        "lastSyncStatus" = COALESCE($4::varchar(50), "lastSyncStatus"),
        "lastSyncError" = $5::text,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1::int
      RETURNING *;
    `,
    [
      Number(id),
      installedVersion ?? null,
      installedComponentVersions
        ? JSON.stringify(normalizeComponentVersions(installedComponentVersions))
        : null,
      lastSyncStatus ?? null,
      lastSyncError,
    ],
  );

  const currentPackagesByProvider = await getCurrentPackagesByProvider();
  return normalizeInstallationRow(result.rows?.[0] ?? null, currentPackagesByProvider);
}
