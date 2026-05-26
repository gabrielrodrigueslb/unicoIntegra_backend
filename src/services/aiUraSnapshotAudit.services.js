import { env } from '../config/env.js';
import {
  getManagedAiProviderDefinition,
  isManagedAiProvider,
} from './aiProviderCatalog.js';
import {
  getAiClientInstallationById,
  listAiClientInstallations,
  upsertAiClientInstallation,
} from './aiClientInstallations.services.js';
import { authenticateInstance, getIvr } from './instanceApi.services.js';
import { createLogService } from './logs.services.js';

const PROVIDER_VAR_MAPPINGS = {
  alpha7: {
    api_key_var: { targetKey: 'apiKey', type: 'string' },
    nome_cliente_var: { targetKey: 'nome_cliente', type: 'string' },
    porta_cliente_var: { targetKey: 'porta_cliente', type: 'string' },
    unidade_negocio_var: { targetKey: 'unidade_negocio', type: 'string' },
    qtd_produtos: { targetKey: 'quantidade_de_produtos', type: 'number' },
    quantidade_de_produtos: { targetKey: 'quantidade_de_produtos', type: 'number' },
  },
  trier: {
    api_key_var: { targetKey: 'apiKey', type: 'string' },
    nome_cliente_var: { targetKey: 'nome_cliente', type: 'string' },
    api_port: { targetKey: 'porta_cliente', type: 'string' },
  },
  vtex: {
    api_key_var: { targetKey: 'apiKey', type: 'string' },
    nome_cliente_var: { targetKey: 'nome_cliente', type: 'string' },
    qtd_produtos: { targetKey: 'quantidade_de_produtos', type: 'number' },
    url_vtex_var: { targetKey: 'url_vtex_variable', type: 'string' },
    vtex_app_key: { targetKey: 'vtex_app_key_variable', type: 'string' },
    vtex_app_token: { targetKey: 'vtex_app_token_variable', type: 'string' },
  },
  vannon: {
    api_key_var: { targetKey: 'apiKey', type: 'string' },
    nome_cliente: { targetKey: 'clientName', type: 'string' },
    clientEndpoint: { targetKey: 'clientEndpoint', type: 'string' },
    cepCliente: { targetKey: 'cepLoja', type: 'string' },
  },
  vetor: {
    api_key_var: { targetKey: 'apiKey', type: 'string' },
    nome_cliente: { targetKey: 'clientName', type: 'string' },
    client_vetor_key: { targetKey: 'vetorToken', type: 'string' },
    client_vetor_unidade: { targetKey: 'unidade_negocio_vetor', type: 'string' },
  },
};

let auditInProgress = false;
let schedulerInterval = null;
let lastAuditRunKey = '';

function parseIvrOptions(options) {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options === 'string' && options.trim()) {
    return JSON.parse(options);
  }

  return [];
}

function extractPrimaryScriptCode(ivr) {
  const options = parseIvrOptions(ivr?.options);
  if (!Array.isArray(options) || options.length === 0) {
    return '';
  }

  const firstScriptBlock =
    options.find(
      (item) =>
        String(item?.id || '') === String(ivr?.initialtext || '') &&
        Number(item?.type) === 21,
    ) || options.find((item) => Number(item?.type) === 21);

  return String(firstScriptBlock?.config?.code || '');
}

function parseJsLiteralValue(rawValue) {
  const normalized = String(rawValue || '')
    .trim()
    .replace(/[;,]\s*$/g, '');

  if (!normalized) return null;

  if (
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('"') && normalized.endsWith('"'))
  ) {
    return normalized.slice(1, -1);
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  return normalized;
}

function parseVarsFromScript(code) {
  const result = {};
  const regex = /vars\[['"]([^'"]+)['"]\]\s*=\s*(.+)$/gm;
  let match = regex.exec(code);

  while (match) {
    const [, key, rawValue] = match;
    result[key] = parseJsLiteralValue(rawValue);
    match = regex.exec(code);
  }

  return result;
}

function normalizeSnapshotValue(value, type) {
  if (type === 'number') {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return numericValue;
  }

  if (value === undefined || value === null) return '';
  return String(value);
}

function buildSnapshotPatchFromVars(provider, varsMap) {
  const mapping = PROVIDER_VAR_MAPPINGS[provider];
  if (!mapping) {
    return {};
  }

  const nextSnapshot = {};

  for (const [varKey, config] of Object.entries(mapping)) {
    if (!(varKey in varsMap)) {
      continue;
    }

    const normalizedValue = normalizeSnapshotValue(varsMap[varKey], config.type);
    if (normalizedValue === null) {
      continue;
    }

    nextSnapshot[config.targetKey] = normalizedValue;
  }

  return nextSnapshot;
}

function getAuditNowParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.AI_URA_AUDIT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

async function auditSingleInstallationUraSnapshot(installation, tokenCache) {
  const providerDefinition = getManagedAiProviderDefinition(installation.provider);
  if (!providerDefinition || !installation.uraIaId) {
    return {
      installationId: installation.id,
      instance: installation.instance,
      provider: installation.provider,
      audited: false,
      updated: false,
      skipped: true,
      message: 'Instalacao sem URA integrada elegivel para auditoria.',
    };
  }

  let token = tokenCache.get(installation.instance);
  if (!token) {
    token = await authenticateInstance(installation.instance);
    tokenCache.set(installation.instance, token);
  }

  const currentUra = await getIvr(installation.instance, installation.uraIaId, token);
  const scriptCode = extractPrimaryScriptCode(currentUra);
  if (!scriptCode) {
    throw new Error('Nao foi possivel localizar o primeiro JavaScript da URA.');
  }

  const varsMap = parseVarsFromScript(scriptCode);
  const snapshotPatch = buildSnapshotPatchFromVars(installation.provider, varsMap);
  if (Object.keys(snapshotPatch).length === 0) {
    return {
      installationId: installation.id,
      instance: installation.instance,
      provider: installation.provider,
      audited: true,
      updated: false,
      skipped: true,
      message: 'Nenhuma variavel auditavel encontrada no primeiro JavaScript da URA.',
    };
  }

  const currentSnapshot = installation.configSnapshot || {};
  const changedFields = Object.entries(snapshotPatch).filter(
    ([key, value]) => JSON.stringify(currentSnapshot[key]) !== JSON.stringify(value),
  );

  if (changedFields.length === 0) {
    return {
      installationId: installation.id,
      instance: installation.instance,
      provider: installation.provider,
      audited: true,
      updated: false,
      skipped: false,
      message: 'Snapshot ja esta sincronizado com a URA.',
    };
  }

  const nextSnapshot = {
    ...currentSnapshot,
    ...snapshotPatch,
  };

  await upsertAiClientInstallation({
    instance: installation.instance,
    provider: installation.provider,
    assistantId: installation.assistantId,
    assistantName: installation.assistantName,
    installedVersion: installation.installedVersion,
    source: installation.source,
    configSnapshot: nextSnapshot,
    installedComponentVersions: installation.installedComponentVersions,
    preProcessId: installation.preProcessId,
    buscaProdutosId: installation.buscaProdutosId,
    downloadImagemId: installation.downloadImagemId,
    gerarCheckoutId: installation.gerarCheckoutId,
    transferirHumanoId: installation.transferirHumanoId,
    uraIaId: installation.uraIaId,
    uraAbId: installation.uraAbId,
    lastSyncStatus: installation.lastSyncStatus,
    lastSyncError: installation.lastSyncError,
  });

  return {
    installationId: installation.id,
    instance: installation.instance,
    provider: installation.provider,
    audited: true,
    updated: true,
    skipped: false,
    changedFields: changedFields.map(([key]) => key),
    message: 'Snapshot atualizado com base na URA da IA.',
  };
}

export async function auditIntegratedAiUraSnapshots({
  installationId,
  requestedBy = 'Sistema',
} = {}) {
  if (auditInProgress) {
    throw new Error('A auditoria de URA ja esta em execucao.');
  }

  auditInProgress = true;
  const tokenCache = new Map();

  try {
    const installations = installationId
      ? [await getAiClientInstallationById(Number(installationId))]
      : await listAiClientInstallations({ limit: 5000 });

    const eligibleInstallations = installations.filter(
      (item) =>
        item &&
        isManagedAiProvider(item.provider) &&
        item.uraIaId &&
        item.provider !== 'legacy',
    );

    const results = [];
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const installation of eligibleInstallations) {
      try {
        const result = await auditSingleInstallationUraSnapshot(
          installation,
          tokenCache,
        );
        results.push(result);

        if (result.updated) {
          updated += 1;
        } else if (result.skipped) {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        results.push({
          installationId: installation.id,
          instance: installation.instance,
          provider: installation.provider,
          audited: false,
          updated: false,
          skipped: false,
          message: error.message || 'Falha ao auditar a URA da IA.',
        });
      }
    }

    const summary = {
      total: eligibleInstallations.length,
      updated,
      failed,
      skipped,
      results,
    };

    await createLogService(
      requestedBy,
      `Auditou snapshots de URA das IAs integradas (${updated} atualizadas, ${failed} falhas, ${skipped} ignoradas)`,
      installationId ? String(installationId) : 'todas',
    );

    return summary;
  } finally {
    auditInProgress = false;
  }
}

export function startAiUraSnapshotAuditScheduler() {
  if (!env.AI_URA_AUDIT_ENABLED || schedulerInterval) {
    return;
  }

  schedulerInterval = setInterval(async () => {
    const now = getAuditNowParts();
    if (
      now.hour !== env.AI_URA_AUDIT_HOUR ||
      now.minute !== env.AI_URA_AUDIT_MINUTE ||
      lastAuditRunKey === now.dateKey
    ) {
      return;
    }

    lastAuditRunKey = now.dateKey;

    try {
      const summary = await auditIntegratedAiUraSnapshots({
        requestedBy: 'Scheduler',
      });
      console.log(
        `[AI_URA_AUDIT] Auditoria concluida: ${summary.updated} atualizadas, ${summary.failed} falhas, ${summary.skipped} ignoradas.`,
      );
    } catch (error) {
      console.error(
        '[AI_URA_AUDIT] Falha ao executar auditoria automatica:',
        error?.message || error,
      );
    }
  }, 60 * 1000);
}
