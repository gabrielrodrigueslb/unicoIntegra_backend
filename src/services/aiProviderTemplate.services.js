import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminPool } from '../database/adminPool.js';
import { parseTemplateContent } from './TemplateService.js';
import {
  MANAGED_AI_PROVIDERS,
  getManagedAiProviderFallbackVersion,
  getManagedAiProviderDefinition,
  getManagedAiTemplatePaths,
} from './aiProviderCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const TEMPLATE_COMPONENT_COLUMN_MAP = {
  assistant: 'assistantTemplate',
  preProcess: 'preProcessTemplate',
  buscaProdutos: 'buscaProdutosTemplate',
  downloadImagem: 'downloadImagemTemplate',
  ura: 'uraTemplate',
  uraAb: 'uraAbTemplate',
};

let aiProviderTemplatesTableReady = false;
let aiProviderTemplatesInitPromise = null;
let aiProviderTemplatesSeedPromise = null;
let aiProviderTemplatesSeeded = false;
let aiProviderTemplatesAvailable = true;

function buildTemplateRowPayload(provider, rawTemplates) {
  const definition = getManagedAiProviderDefinition(provider);

  return {
    provider,
    templateName: definition.templateName,
    assistantTemplate: rawTemplates.assistant,
    preProcessTemplate: rawTemplates.preProcess,
    buscaProdutosTemplate: rawTemplates.buscaProdutos,
    downloadImagemTemplate: rawTemplates.downloadImagem,
    uraTemplate: rawTemplates.ura,
    uraAbTemplate: rawTemplates.uraAb,
  };
}

async function readTemplateFileRaw(sourcePath) {
  const fullPath = path.join(TEMPLATES_DIR, sourcePath);
  return fs.readFile(fullPath, 'utf-8');
}

async function loadProviderRawTemplates(provider) {
  const templatePaths = getManagedAiTemplatePaths(provider);
  const entries = Object.entries(templatePaths);
  const rawTemplates = {};

  for (const [componentKey, sourcePath] of entries) {
    rawTemplates[componentKey] = await readTemplateFileRaw(sourcePath);
  }

  return rawTemplates;
}

function providerTemplatesChanged(currentRow, nextRow) {
  if (!currentRow) return true;

  return Object.values(TEMPLATE_COMPONENT_COLUMN_MAP).some(
    (column) => currentRow[column] !== nextRow[column],
  );
}

async function createNextProviderTemplateVersion(provider, nextRow) {
  const currentQuery = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_provider_templates
      WHERE provider = $1::varchar(50)
        AND "isCurrent" = true
      ORDER BY version DESC, id DESC
      LIMIT 1;
    `,
    [provider],
  );

  const current = currentQuery.rows?.[0] ?? null;
  if (!providerTemplatesChanged(current, nextRow)) {
    return {
      changed: false,
      row: current,
    };
  }

  const aggregate = await adminPool.query(
    `
      SELECT COALESCE(MAX(version), 0) AS "maxVersion"
      FROM sistema.ai_provider_templates
      WHERE provider = $1::varchar(50);
    `,
    [provider],
  );

  const nextVersion = Number(aggregate.rows?.[0]?.maxVersion || 0) + 1;

  await adminPool.query(
    `
      UPDATE sistema.ai_provider_templates
      SET "isCurrent" = false
      WHERE provider = $1::varchar(50)
        AND "isCurrent" = true;
    `,
    [provider],
  );

  const insertResult = await adminPool.query(
    `
      INSERT INTO sistema.ai_provider_templates (
        provider,
        "templateName",
        version,
        "assistantTemplate",
        "preProcessTemplate",
        "buscaProdutosTemplate",
        "downloadImagemTemplate",
        "uraTemplate",
        "uraAbTemplate",
        "isCurrent",
        "isActive"
      )
      VALUES (
        $1::varchar(50),
        $2::varchar(255),
        $3::int,
        $4::text,
        $5::text,
        $6::text,
        $7::text,
        $8::text,
        $9::text,
        true,
        true
      )
      RETURNING *;
    `,
    [
      nextRow.provider,
      nextRow.templateName,
      nextVersion,
      nextRow.assistantTemplate,
      nextRow.preProcessTemplate,
      nextRow.buscaProdutosTemplate,
      nextRow.downloadImagemTemplate,
      nextRow.uraTemplate,
      nextRow.uraAbTemplate,
    ],
  );

  return {
    changed: true,
    row: insertResult.rows?.[0] ?? null,
  };
}

function normalizeTemplateRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    templateName: row.templateName,
    version: row.version,
    assistantTemplate: row.assistantTemplate,
    preProcessTemplate: row.preProcessTemplate,
    buscaProdutosTemplate: row.buscaProdutosTemplate,
    downloadImagemTemplate: row.downloadImagemTemplate,
    uraTemplate: row.uraTemplate,
    uraAbTemplate: row.uraAbTemplate,
    isCurrent: row.isCurrent,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureAiProviderTemplatesTableExists() {
  if (!aiProviderTemplatesAvailable) return;
  if (aiProviderTemplatesTableReady) return;
  if (aiProviderTemplatesInitPromise) {
    await aiProviderTemplatesInitPromise;
    return;
  }

  aiProviderTemplatesInitPromise = (async () => {
    try {
      await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);

      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS sistema.ai_provider_templates (
          id SERIAL PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          "templateName" VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          "assistantTemplate" TEXT NOT NULL,
          "preProcessTemplate" TEXT NOT NULL,
          "buscaProdutosTemplate" TEXT NOT NULL,
          "downloadImagemTemplate" TEXT NOT NULL,
          "uraTemplate" TEXT NOT NULL,
          "uraAbTemplate" TEXT NOT NULL,
          "isCurrent" BOOLEAN NOT NULL DEFAULT true,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await adminPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_templates_provider_version_key
        ON sistema.ai_provider_templates (provider, version);
      `);

      await adminPool.query(`
        CREATE INDEX IF NOT EXISTS ai_provider_templates_provider_current_idx
        ON sistema.ai_provider_templates (provider, "isCurrent");
      `);

      aiProviderTemplatesTableReady = true;
    } catch (error) {
      if (error?.code === '42501') {
        const check = await adminPool.query(`
          SELECT to_regclass('sistema.ai_provider_templates') AS table_name;
        `);

        if (check.rows?.[0]?.table_name) {
          console.warn(
            'AI_PROVIDER_TEMPLATE WARN: Sem permissao de ownership. Usando tabela existente.',
          );
          aiProviderTemplatesTableReady = true;
          return;
        }
      }

      throw error;
    }
  })();

  try {
    await aiProviderTemplatesInitPromise;
  } catch (error) {
    aiProviderTemplatesAvailable = false;
    console.warn(
      'AI_PROVIDER_TEMPLATE WARN: Banco indisponivel para templates por provider. Usando arquivos locais.',
      error?.message || error,
    );
    return;
  } finally {
    aiProviderTemplatesInitPromise = null;
  }
}

export async function syncCurrentAiProviderTemplatesToDb() {
  await ensureAiProviderTemplatesTableExists();
  if (!aiProviderTemplatesAvailable) {
    return MANAGED_AI_PROVIDERS.map((provider) => ({
      provider,
      templateName: getManagedAiProviderDefinition(provider)?.templateName || provider,
      version: getManagedAiProviderFallbackVersion(provider),
      changed: false,
      isCurrent: true,
      source: 'file-fallback',
    }));
  }

  const results = [];
  for (const provider of MANAGED_AI_PROVIDERS) {
    const rawTemplates = await loadProviderRawTemplates(provider);
    const rowPayload = buildTemplateRowPayload(provider, rawTemplates);
    const result = await createNextProviderTemplateVersion(provider, rowPayload);

    results.push({
      provider,
      templateName: rowPayload.templateName,
      version: result.row?.version ?? null,
      changed: result.changed,
      isCurrent: result.row?.isCurrent ?? false,
    });
  }

  return results;
}

export async function ensureCurrentAiProviderTemplatesSeeded() {
  if (!aiProviderTemplatesAvailable) {
    return;
  }

  if (aiProviderTemplatesSeeded) {
    return;
  }

  if (aiProviderTemplatesSeedPromise) {
    await aiProviderTemplatesSeedPromise;
    return;
  }

  aiProviderTemplatesSeedPromise = (async () => {
    await ensureAiProviderTemplatesTableExists();
    if (!aiProviderTemplatesAvailable) return;
    await syncCurrentAiProviderTemplatesToDb();
  })();

  try {
    await aiProviderTemplatesSeedPromise;
    aiProviderTemplatesSeeded = true;
  } finally {
    aiProviderTemplatesSeedPromise = null;
  }
}

export async function getCurrentAiProviderTemplatePackage(provider) {
  await ensureCurrentAiProviderTemplatesSeeded();
  if (!aiProviderTemplatesAvailable) {
    return buildFallbackTemplateRow(provider);
  }

  const result = await adminPool.query(
    `
      SELECT *
      FROM sistema.ai_provider_templates
      WHERE provider = $1::varchar(50)
        AND "isCurrent" = true
        AND "isActive" = true
      ORDER BY version DESC, id DESC
      LIMIT 1;
    `,
    [provider],
  );

  return normalizeTemplateRow(result.rows?.[0] ?? null) || buildFallbackTemplateRow(provider);
}

export async function listCurrentAiProviderTemplatePackages() {
  await ensureCurrentAiProviderTemplatesSeeded();
  if (!aiProviderTemplatesAvailable) {
    return MANAGED_AI_PROVIDERS.map((provider) => buildFallbackTemplateRow(provider));
  }

  const result = await adminPool.query(`
    SELECT *
    FROM sistema.ai_provider_templates
    WHERE "isCurrent" = true
      AND "isActive" = true
    ORDER BY provider ASC, version DESC, id DESC;
  `);

  return (result.rows ?? []).map(normalizeTemplateRow);
}

export async function loadAiProviderTemplateComponent(
  provider,
  componentKey,
  variables = {},
) {
  const column = TEMPLATE_COMPONENT_COLUMN_MAP[componentKey];
  if (!column) {
    throw new Error(`Componente de template invalido: ${componentKey}`);
  }

  try {
    const row = await getCurrentAiProviderTemplatePackage(provider);
    if (row?.[column]) {
      return parseTemplateContent(row[column], variables, '.json');
    }
  } catch (error) {
    console.error(
      `AI_PROVIDER_TEMPLATE WARN: Falha ao carregar '${provider}/${componentKey}' do banco. Usando arquivo local.`,
      error.message || error,
    );
  }

  const templatePaths = getManagedAiTemplatePaths(provider);
  const sourcePath = templatePaths[componentKey];
  const rawTemplate = await readTemplateFileRaw(sourcePath);
  return parseTemplateContent(rawTemplate, variables, '.json');
}

function buildFallbackTemplateRow(provider) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) return null;

  return {
    id: null,
    provider,
    templateName: definition.templateName,
    version: getManagedAiProviderFallbackVersion(provider),
    assistantTemplate: null,
    preProcessTemplate: null,
    buscaProdutosTemplate: null,
    downloadImagemTemplate: null,
    uraTemplate: null,
    uraAbTemplate: null,
    isCurrent: true,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}
