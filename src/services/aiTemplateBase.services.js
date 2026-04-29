import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminPool } from '../database/adminPool.js';
import {
  loadAndParseTemplate,
  parseTemplateContent,
} from './TemplateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const AI_TEMPLATE_DEFINITIONS = [
  {
    templateKey: 'atendimento',
    templateName: 'IA - Atendimento',
    sourcePath: 'ia/default_atendimento_ia_config.json',
    contentType: 'json-template',
  },
  {
    templateKey: 'alpha7',
    templateName: 'IA - Alpha 7',
    sourcePath: 'ia/alpha7/alpha_ia_config.json',
    contentType: 'json-template',
  },
  {
    templateKey: 'trier',
    templateName: 'IA - Trier',
    sourcePath: 'ia/trier/trier_ia_config.json',
    contentType: 'json-template',
  },
  {
    templateKey: 'vannon',
    templateName: 'IA - Vannon',
    sourcePath: 'ia/vannon/Vannon_ai_config.json',
    contentType: 'json-template',
  },
  {
    templateKey: 'vetor',
    templateName: 'IA - Vetor',
    sourcePath: 'ia/vetor/vetor_ai_config.json',
    contentType: 'json-template',
  },
];

let aiTemplateBasesTableReady = false;
let aiTemplateBasesInitPromise = null;
let aiTemplateSeedPromise = null;
let aiTemplateBasesWriteAvailable = true;

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function parseBooleanFlag(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}

async function readTemplateFileRaw(sourcePath) {
  const fullPath = path.join(TEMPLATES_DIR, sourcePath);
  return fs.readFile(fullPath, 'utf-8');
}

function normalizeTemplateBaseRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    templateKey: row.templateKey,
    templateName: row.templateName,
    version: row.version,
    contentType: row.contentType,
    sourcePath: row.sourcePath,
    isCurrent: row.isCurrent,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    templateContent: row.templateContent,
    immutablePaths: row.immutablePaths ?? null,
    ivrBindings: row.ivrBindings ?? null,
  };
}

function isPermissionDeniedError(error) {
  return error?.code === '42501';
}

async function buildFallbackTemplateBaseRow(definition) {
  const templateContent = await readTemplateFileRaw(definition.sourcePath);

  return {
    id: null,
    templateKey: definition.templateKey,
    templateName: definition.templateName,
    version: 1,
    contentType: definition.contentType,
    sourcePath: definition.sourcePath,
    isCurrent: true,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    templateContent,
    immutablePaths: null,
    ivrBindings: null,
  };
}

export async function ensureAiTemplateBasesTableExists() {
  if (aiTemplateBasesTableReady) return;
  if (aiTemplateBasesInitPromise) {
    await aiTemplateBasesInitPromise;
    return;
  }

  aiTemplateBasesInitPromise = (async () => {
    try {
      await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);

      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS sistema.ai_template_bases (
          id SERIAL PRIMARY KEY,
          "templateKey" VARCHAR(100) NOT NULL,
          "templateName" VARCHAR(255) NOT NULL,
          "version" INTEGER NOT NULL,
          "templateContent" TEXT NOT NULL,
          "contentType" VARCHAR(50) NOT NULL DEFAULT 'json-template',
          "sourcePath" VARCHAR(255),
          "isCurrent" BOOLEAN NOT NULL DEFAULT true,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await adminPool.query(`
        ALTER TABLE sistema.ai_template_bases
        ADD COLUMN IF NOT EXISTS "immutablePaths" JSONB;
      `);

      await adminPool.query(`
        ALTER TABLE sistema.ai_template_bases
        ADD COLUMN IF NOT EXISTS "ivrBindings" JSONB;
      `);

      await adminPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ai_template_bases_templateKey_version_key
        ON sistema.ai_template_bases ("templateKey", "version");
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_template_bases_templateKey_isCurrent_idx
        ON sistema.ai_template_bases ("templateKey", "isCurrent");
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_template_bases_isCurrent_idx
        ON sistema.ai_template_bases ("isCurrent");
      `);

      aiTemplateBasesTableReady = true;
    } catch (error) {
      if (error?.code === '42501') {
        const check = await adminPool.query(`
          SELECT to_regclass('sistema.ai_template_bases') AS table_name;
        `);

        if (check.rows?.[0]?.table_name) {
          console.warn(
            'AI_TEMPLATE WARN: Sem permissao de ownership para alterar indices de sistema.ai_template_bases. Usando tabela existente.',
          );
          aiTemplateBasesTableReady = true;
          return;
        }
      }

      throw error;
    }
  })();

  try {
    await aiTemplateBasesInitPromise;
  } finally {
    aiTemplateBasesInitPromise = null;
  }
}

async function createNextTemplateVersion(definition, templateContent) {
  const currentResult = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_template_bases
      WHERE "templateKey" = $1::varchar(100)
        AND "isCurrent" = true
      ORDER BY version DESC, id DESC
      LIMIT 1;
    `,
    [definition.templateKey],
  );

  const current = currentResult.rows?.[0] ?? null;

  if (
    current &&
    current.templateContent === templateContent &&
    current.templateName === definition.templateName &&
    current.sourcePath === definition.sourcePath &&
    current.contentType === definition.contentType &&
    current.isActive
  ) {
    return { changed: false, row: normalizeTemplateBaseRow(current) };
  }

  const aggregate = await adminPool.query(
    `
      SELECT COALESCE(MAX(version), 0) AS "maxVersion"
      FROM sistema.ai_template_bases
      WHERE "templateKey" = $1::varchar(100);
    `,
    [definition.templateKey],
  );

  const nextVersion = Number(aggregate.rows?.[0]?.maxVersion || 0) + 1;

  await adminPool.query(
    `
      UPDATE sistema.ai_template_bases
      SET "isCurrent" = false
      WHERE "templateKey" = $1::varchar(100)
        AND "isCurrent" = true;
    `,
    [definition.templateKey],
  );

  const insertResult = await adminPool.query(
    `
      INSERT INTO sistema.ai_template_bases (
        "templateKey",
        "templateName",
        version,
        "templateContent",
        "contentType",
        "sourcePath",
        "isCurrent",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1::varchar(100),
        $2::varchar(255),
        $3::int,
        $4::text,
        $5::varchar(50),
        $6::varchar(255),
        true,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *;
    `,
    [
      definition.templateKey,
      definition.templateName,
      nextVersion,
      templateContent,
      definition.contentType,
      definition.sourcePath,
    ],
  );

  return { changed: true, row: normalizeTemplateBaseRow(insertResult.rows?.[0] ?? null) };
}

async function createManualTemplateVersion({
  templateKey,
  templateName,
  templateContent,
  contentType = 'json-template',
  sourcePath = null,
  isActive = true,
}) {
  const normalizedTemplateKey = normalizeOptionalString(templateKey);
  const normalizedTemplateName = normalizeOptionalString(templateName);
  const normalizedContentType = normalizeOptionalString(contentType) || 'json-template';
  const normalizedSourcePath = normalizeOptionalString(sourcePath);

  if (!normalizedTemplateKey) {
    throw new Error('templateKey e obrigatorio.');
  }

  if (!normalizedTemplateName) {
    throw new Error('templateName e obrigatorio.');
  }

  if (typeof templateContent !== 'string' || !templateContent.trim()) {
    throw new Error('templateContent e obrigatorio.');
  }

  const currentResult = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_template_bases
      WHERE "templateKey" = $1::varchar(100)
        AND "isCurrent" = true
      ORDER BY version DESC, id DESC
      LIMIT 1;
    `,
    [normalizedTemplateKey],
  );

  const current = currentResult.rows?.[0] ?? null;

  if (
    current &&
    current.templateContent === templateContent &&
    current.templateName === normalizedTemplateName &&
    current.sourcePath === normalizedSourcePath &&
    current.contentType === normalizedContentType &&
    current.isActive === Boolean(isActive)
  ) {
    return { changed: false, row: normalizeTemplateBaseRow(current) };
  }

  const aggregate = await adminPool.query(
    `
      SELECT COALESCE(MAX(version), 0) AS "maxVersion"
      FROM sistema.ai_template_bases
      WHERE "templateKey" = $1::varchar(100);
    `,
    [normalizedTemplateKey],
  );

  const nextVersion = Number(aggregate.rows?.[0]?.maxVersion || 0) + 1;

  await adminPool.query(
    `
      UPDATE sistema.ai_template_bases
      SET "isCurrent" = false
      WHERE "templateKey" = $1::varchar(100)
        AND "isCurrent" = true;
    `,
    [normalizedTemplateKey],
  );

  const insertResult = await adminPool.query(
    `
      INSERT INTO sistema.ai_template_bases (
        "templateKey",
        "templateName",
        version,
        "templateContent",
        "contentType",
        "sourcePath",
        "isCurrent",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1::varchar(100),
        $2::varchar(255),
        $3::int,
        $4::text,
        $5::varchar(50),
        $6::varchar(255),
        true,
        $7::boolean,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *;
    `,
    [
      normalizedTemplateKey,
      normalizedTemplateName,
      nextVersion,
      templateContent,
      normalizedContentType,
      normalizedSourcePath,
      Boolean(isActive),
    ],
  );

  return { changed: true, row: normalizeTemplateBaseRow(insertResult.rows?.[0] ?? null) };
}

export async function syncCurrentAiTemplatesToDb() {
  await ensureAiTemplateBasesTableExists();
  if (!aiTemplateBasesWriteAvailable) {
    return Promise.all(
      AI_TEMPLATE_DEFINITIONS.map(async (definition) => ({
        templateKey: definition.templateKey,
        templateName: definition.templateName,
        sourcePath: definition.sourcePath,
        version: 1,
        changed: false,
        isCurrent: true,
        source: 'file-fallback',
      })),
    );
  }

  const results = [];

  for (const definition of AI_TEMPLATE_DEFINITIONS) {
    const templateContent = await readTemplateFileRaw(definition.sourcePath);
    const result = await createNextTemplateVersion(definition, templateContent);
    results.push({
      templateKey: definition.templateKey,
      templateName: definition.templateName,
      sourcePath: definition.sourcePath,
      version: result.row.version,
      changed: result.changed,
      isCurrent: result.row.isCurrent,
    });
  }

  return results;
}

export async function ensureCurrentAiTemplatesSeeded() {
  if (aiTemplateSeedPromise) {
    await aiTemplateSeedPromise;
    return;
  }

  aiTemplateSeedPromise = (async () => {
    await ensureAiTemplateBasesTableExists();
    await syncCurrentAiTemplatesToDb();
  })();

  try {
    await aiTemplateSeedPromise;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      aiTemplateBasesWriteAvailable = false;
      console.warn(
        'AI_TEMPLATE WARN: Sem permissao para versionar sistema.ai_template_bases. Usando modo somente leitura com fallback em arquivo.',
      );
      return;
    }

    throw error;
  } finally {
    aiTemplateSeedPromise = null;
  }
}

export async function listAiTemplateBases({ currentOnly = true, limit = 100 } = {}) {
  await ensureCurrentAiTemplatesSeeded();
  const currentOnlyFlag = parseBooleanFlag(currentOnly, true);

  if (!aiTemplateBasesWriteAvailable) {
    const fallbackRows = await Promise.all(
      AI_TEMPLATE_DEFINITIONS.map((definition) => buildFallbackTemplateBaseRow(definition)),
    );
    const filteredRows = currentOnlyFlag
      ? fallbackRows.filter((row) => row.isCurrent)
      : fallbackRows;

    return filteredRows.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 500));
  }

  const params = [];
  const clauses = [];

  if (currentOnlyFlag) {
    clauses.push(`"isCurrent" = true`);
  }

  params.push(Math.min(Math.max(Number(limit) || 50, 1), 500));

  const result = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_template_bases
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY "templateKey" ASC, version DESC, id DESC
      LIMIT $${params.length}::int;
    `,
    params,
  );

  return (result.rows ?? []).map(normalizeTemplateBaseRow);
}

export async function saveAiTemplateBase(input = {}) {
  await ensureAiTemplateBasesTableExists();
  if (!aiTemplateBasesWriteAvailable) {
    throw new Error(
      'Banco sem permissao de escrita para versionar templates base de IA.',
    );
  }

  const result = await createManualTemplateVersion({
    templateKey: input.templateKey,
    templateName: input.templateName,
    templateContent: input.templateContent,
    contentType: input.contentType,
    sourcePath: input.sourcePath,
    isActive: input.isActive,
  });

  return {
    changed: result.changed,
    row: normalizeTemplateBaseRow(result.row),
  };
}

async function getCurrentAiTemplateRow(templateKey) {
  await ensureCurrentAiTemplatesSeeded();

  if (!aiTemplateBasesWriteAvailable) {
    const definition = AI_TEMPLATE_DEFINITIONS.find(
      (item) => item.templateKey === templateKey,
    );
    return definition ? buildFallbackTemplateBaseRow(definition) : null;
  }

  const result = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_template_bases
      WHERE "templateKey" = $1::varchar(100)
        AND "isCurrent" = true
        AND "isActive" = true
      ORDER BY version DESC, id DESC
      LIMIT 1;
    `,
    [templateKey],
  );

  return normalizeTemplateBaseRow(result.rows?.[0] ?? null);
}

export async function loadAiTemplateFromDbOrFile(
  templateKey,
  variables,
  fallbackTemplatePath,
  { requireDatabase = false } = {},
) {
  if (requireDatabase) {
    const row = await getCurrentAiTemplateRow(templateKey);
    if (!row?.templateContent) {
      throw new Error(
        `Template base '${templateKey}' nao encontrado no banco. O fluxo operacional nao usa fallback em arquivo local.`,
      );
    }

    return parseTemplateContent(row.templateContent, variables, '.json');
  }

  try {
    const row = await getCurrentAiTemplateRow(templateKey);
    if (row?.templateContent) {
      return parseTemplateContent(row.templateContent, variables, '.json');
    }
  } catch (error) {
    console.error(
      `AI_TEMPLATE WARN: Falha ao carregar template '${templateKey}' do banco. Usando arquivo local.`,
      error.message || error,
    );
  }

  return loadAndParseTemplate(fallbackTemplatePath, variables);
}
