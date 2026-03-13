import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../../prisma/PrismaClient.js';
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
    templateKey: 'vannon',
    templateName: 'IA - Vannon',
    sourcePath: 'ia/vannon/Vannon_ai_config.json',
    contentType: 'json-template',
  },
];

let aiTemplateBasesTableReady = false;
let aiTemplateBasesInitPromise = null;
let aiTemplateSeedPromise = null;

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
  return prisma.$transaction(async (tx) => {
    const current = await tx.aiTemplateBase.findFirst({
      where: {
        templateKey: definition.templateKey,
        isCurrent: true,
      },
      orderBy: [{ version: 'desc' }, { id: 'desc' }],
    });

    if (
      current &&
      current.templateContent === templateContent &&
      current.templateName === definition.templateName &&
      current.sourcePath === definition.sourcePath &&
      current.contentType === definition.contentType &&
      current.isActive
    ) {
      return { changed: false, row: current };
    }

    const aggregate = await tx.aiTemplateBase.aggregate({
      where: { templateKey: definition.templateKey },
      _max: { version: true },
    });

    const nextVersion = (aggregate._max.version ?? 0) + 1;

    await tx.aiTemplateBase.updateMany({
      where: { templateKey: definition.templateKey, isCurrent: true },
      data: { isCurrent: false },
    });

    const row = await tx.aiTemplateBase.create({
      data: {
        templateKey: definition.templateKey,
        templateName: definition.templateName,
        version: nextVersion,
        templateContent,
        contentType: definition.contentType,
        sourcePath: definition.sourcePath,
        isCurrent: true,
        isActive: true,
      },
    });

    return { changed: true, row };
  });
}

export async function syncCurrentAiTemplatesToDb() {
  await ensureAiTemplateBasesTableExists();

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
  } finally {
    aiTemplateSeedPromise = null;
  }
}

export async function listAiTemplateBases({ currentOnly = true, limit = 100 } = {}) {
  await ensureCurrentAiTemplatesSeeded();
  const currentOnlyFlag = parseBooleanFlag(currentOnly, true);

  const rows = await prisma.aiTemplateBase.findMany({
    where: currentOnlyFlag ? { isCurrent: true } : undefined,
    take: Math.min(Math.max(Number(limit) || 50, 1), 500),
    orderBy: [
      { templateKey: 'asc' },
      { version: 'desc' },
      { id: 'desc' },
    ],
  });

  return rows.map((row) => ({
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
  }));
}

async function getCurrentAiTemplateRow(templateKey) {
  await ensureCurrentAiTemplatesSeeded();

  return prisma.aiTemplateBase.findFirst({
    where: { templateKey, isCurrent: true, isActive: true },
    orderBy: [{ version: 'desc' }, { id: 'desc' }],
  });
}

export async function loadAiTemplateFromDbOrFile(
  templateKey,
  variables,
  fallbackTemplatePath,
) {
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
