import { adminPool } from '../database/adminPool.js';
import {
  MANAGED_AI_COMPONENT_KEYS,
  MANAGED_AI_PROVIDERS,
  getManagedAiProviderDefinition,
} from './aiProviderCatalog.js';
import {
  listAiProviderTemplatePackages,
  saveAiProviderTemplatePackage,
} from './aiProviderTemplate.services.js';
import {
  listAiTemplateBases,
  saveAiTemplateBase,
} from './aiTemplateBase.services.js';
const COMPONENT_FIELD_MAP = {
  assistant: 'assistantTemplate',
  preProcess: 'preProcessTemplate',
  buscaProdutos: 'buscaProdutosTemplate',
  downloadImagem: 'downloadImagemTemplate',
  gerarCheckout: 'gerarCheckoutTemplate',
  transferirHumano: 'transferirHumanoTemplate',
  ura: 'uraTemplate',
  uraAb: 'uraAbTemplate',
};

function normalizeProvider(provider) {
  return String(provider || '').trim().toLowerCase();
}

function emptyWorkspaceStore() {
  return {
    providers: {},
  };
}

let workspaceTableReady = false;
let workspaceInitPromise = null;
let workspaceDbAvailable = true;

async function ensureWorkspaceTableExists() {
  if (!workspaceDbAvailable) return;
  if (workspaceTableReady) return;
  if (workspaceInitPromise) {
    await workspaceInitPromise;
    return;
  }

  workspaceInitPromise = (async () => {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS sistema.ai_template_workspaces (
        provider VARCHAR(50) PRIMARY KEY,
        draft JSONB NOT NULL,
        "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    workspaceTableReady = true;
  })();

  try {
    await workspaceInitPromise;
  } catch (error) {
    workspaceDbAvailable = false;
    throw error;
  } finally {
    workspaceInitPromise = null;
  }
}

async function readWorkspaceStore() {
  await ensureWorkspaceTableExists();
  try {
    const result = await adminPool.query(`
      SELECT provider, draft
      FROM sistema.ai_template_workspaces
      ORDER BY provider ASC;
    `);

    const store = emptyWorkspaceStore();
    for (const row of result.rows ?? []) {
      if (!row?.provider) continue;
      store.providers[row.provider] =
        row.draft && typeof row.draft === 'object' ? row.draft : null;
    }
    return store;
  } catch {
    return emptyWorkspaceStore();
  }
}

async function writeWorkspaceStore(store) {
  await ensureWorkspaceTableExists();
  const providers = store?.providers && typeof store.providers === 'object'
    ? store.providers
    : {};
  const providerKeys = Object.keys(providers);

  await adminPool.query('BEGIN');

  try {
    if (providerKeys.length > 0) {
      await adminPool.query(
        `
          DELETE FROM sistema.ai_template_workspaces
          WHERE provider <> ALL($1::varchar(50)[]);
        `,
        [providerKeys],
      );
    } else {
      await adminPool.query(`DELETE FROM sistema.ai_template_workspaces;`);
    }

    for (const provider of providerKeys) {
      await adminPool.query(
        `
          INSERT INTO sistema.ai_template_workspaces (provider, draft, "updatedAt")
          VALUES ($1::varchar(50), $2::jsonb, CURRENT_TIMESTAMP)
          ON CONFLICT (provider)
          DO UPDATE SET
            draft = EXCLUDED.draft,
            "updatedAt" = CURRENT_TIMESTAMP;
        `,
        [provider, JSON.stringify(providers[provider] || {})],
      );
    }

    await adminPool.query('COMMIT');
  } catch (error) {
    await adminPool.query('ROLLBACK');
    throw error;
  }
}

function buildDraftPayload(provider, payload = {}) {
  const definition = getManagedAiProviderDefinition(provider);

  return {
    provider,
    templateName:
      String(payload.templateName || '').trim() ||
      definition?.templateName ||
      provider,
    baseTemplateName:
      String(payload.baseTemplateName || '').trim() ||
      definition?.displayName ||
      provider,
    contentType: String(payload.contentType || '').trim() || 'json-template',
    sourcePath: payload.sourcePath ?? null,
    baseTemplateContent: String(payload.baseTemplateContent || ''),
    assistantTemplate: String(payload.assistantTemplate || ''),
    preProcessTemplate: String(payload.preProcessTemplate || ''),
    buscaProdutosTemplate: String(payload.buscaProdutosTemplate || ''),
    downloadImagemTemplate: String(payload.downloadImagemTemplate || ''),
    gerarCheckoutTemplate: String(payload.gerarCheckoutTemplate || ''),
    transferirHumanoTemplate: String(payload.transferirHumanoTemplate || ''),
    uraTemplate: String(payload.uraTemplate || ''),
    uraAbTemplate: String(payload.uraAbTemplate || ''),
    basedOnBaseVersion: Number(payload.basedOnBaseVersion || 0) || null,
    basedOnPackageVersion: Number(payload.basedOnPackageVersion || 0) || null,
    updatedAt: new Date().toISOString(),
  };
}

function buildHasChanges(draft, baseCurrent, packageCurrent) {
  if (!draft) return false;

  return Boolean(
    draft.baseTemplateContent !== (baseCurrent?.templateContent ?? '') ||
      draft.assistantTemplate !== (packageCurrent?.assistantTemplate ?? '') ||
      draft.preProcessTemplate !== (packageCurrent?.preProcessTemplate ?? '') ||
      draft.buscaProdutosTemplate !== (packageCurrent?.buscaProdutosTemplate ?? '') ||
      draft.downloadImagemTemplate !== (packageCurrent?.downloadImagemTemplate ?? '') ||
      draft.gerarCheckoutTemplate !== (packageCurrent?.gerarCheckoutTemplate ?? '') ||
      draft.transferirHumanoTemplate !== (packageCurrent?.transferirHumanoTemplate ?? '') ||
      draft.uraTemplate !== (packageCurrent?.uraTemplate ?? '') ||
      draft.uraAbTemplate !== (packageCurrent?.uraAbTemplate ?? ''),
  );
}

function buildReleasePayloadFromPackage(row) {
  return {
    templateName: row.templateName,
    assistantTemplate: row.assistantTemplate,
    preProcessTemplate: row.preProcessTemplate,
    buscaProdutosTemplate: row.buscaProdutosTemplate,
    downloadImagemTemplate: row.downloadImagemTemplate,
    gerarCheckoutTemplate: row.gerarCheckoutTemplate,
    transferirHumanoTemplate: row.transferirHumanoTemplate,
    uraTemplate: row.uraTemplate,
    uraAbTemplate: row.uraAbTemplate,
    isActive: row.isActive,
  };
}

function normalizeReleaseScope(scope) {
  const normalized = String(scope || 'all').trim();
  if (!normalized || normalized === 'all') return 'all';
  if (normalized === 'base') return 'base';
  if (MANAGED_AI_COMPONENT_KEYS.includes(normalized)) {
    return normalized;
  }

  throw new Error(`Escopo de release invalido: ${normalized}`);
}

function buildPackageDraftDiff(draft, packageCurrent) {
  if (!draft) return false;

  return Object.values(COMPONENT_FIELD_MAP).some(
    (field) => draft[field] !== (packageCurrent?.[field] ?? ''),
  );
}

function buildPackageReleasePayload(context, componentScope = null) {
  const templateName =
    context.draft?.templateName ||
    context.packageCurrent?.templateName ||
    getManagedAiProviderDefinition(context.provider)?.templateName ||
    context.provider;

  const payload = {
    templateName,
    assistantTemplate: context.packageCurrent?.assistantTemplate ?? '',
    preProcessTemplate: context.packageCurrent?.preProcessTemplate ?? '',
    buscaProdutosTemplate: context.packageCurrent?.buscaProdutosTemplate ?? '',
    downloadImagemTemplate: context.packageCurrent?.downloadImagemTemplate ?? '',
    gerarCheckoutTemplate: context.packageCurrent?.gerarCheckoutTemplate ?? '',
    transferirHumanoTemplate: context.packageCurrent?.transferirHumanoTemplate ?? '',
    uraTemplate: context.packageCurrent?.uraTemplate ?? '',
    uraAbTemplate: context.packageCurrent?.uraAbTemplate ?? '',
    isActive: true,
  };

  if (!context.draft) {
    return payload;
  }

  if (!componentScope) {
    return {
      ...payload,
      assistantTemplate: context.draft.assistantTemplate,
      preProcessTemplate: context.draft.preProcessTemplate,
      buscaProdutosTemplate: context.draft.buscaProdutosTemplate,
      downloadImagemTemplate: context.draft.downloadImagemTemplate,
      gerarCheckoutTemplate: context.draft.gerarCheckoutTemplate,
      transferirHumanoTemplate: context.draft.transferirHumanoTemplate,
      uraTemplate: context.draft.uraTemplate,
      uraAbTemplate: context.draft.uraAbTemplate,
    };
  }

  const field = COMPONENT_FIELD_MAP[componentScope];
  if (field) {
    payload[field] = context.draft[field];
  }

  return payload;
}

async function persistWorkspaceAfterScopedRelease(context, scope) {
  const latestContext = await getProviderContext(context.provider);
  const currentDraft = context.draft;
  if (!currentDraft) {
    return latestContext;
  }

  const nextDraft = {
    ...currentDraft,
    basedOnBaseVersion: latestContext.baseCurrent?.version ?? currentDraft.basedOnBaseVersion,
    basedOnPackageVersion:
      latestContext.packageCurrent?.version ?? currentDraft.basedOnPackageVersion,
    updatedAt: new Date().toISOString(),
  };

  if (scope === 'all') {
    const store = await readWorkspaceStore();
    delete store.providers[context.provider];
    await writeWorkspaceStore(store);
    return getProviderContext(context.provider);
  }

  if (scope === 'base') {
    nextDraft.baseTemplateContent = latestContext.baseCurrent?.templateContent ?? '';
    nextDraft.baseTemplateName = latestContext.baseCurrent?.templateName ?? nextDraft.baseTemplateName;
    nextDraft.contentType = latestContext.baseCurrent?.contentType ?? nextDraft.contentType;
    nextDraft.sourcePath = latestContext.baseCurrent?.sourcePath ?? nextDraft.sourcePath;
  } else {
    const field = COMPONENT_FIELD_MAP[scope];
    if (field) {
      nextDraft[field] = latestContext.packageCurrent?.[field] ?? '';
      nextDraft.templateName =
        latestContext.packageCurrent?.templateName ?? nextDraft.templateName;
    }
  }

  const store = await readWorkspaceStore();
  const hasChanges = buildHasChanges(
    nextDraft,
    latestContext.baseCurrent,
    latestContext.packageCurrent,
  );

  if (!hasChanges) {
    delete store.providers[context.provider];
  } else {
    store.providers[context.provider] = nextDraft;
  }

  await writeWorkspaceStore(store);
  return getProviderContext(context.provider);
}

async function getProviderContext(provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) {
    throw new Error('provider e obrigatorio.');
  }

  if (!MANAGED_AI_PROVIDERS.includes(normalizedProvider)) {
    throw new Error(`Provider de IA nao suportado: ${normalizedProvider}`);
  }

  const [baseHistory, packageHistory, store] = await Promise.all([
    listAiTemplateBases({ currentOnly: false, limit: 500 }),
    listAiProviderTemplatePackages({
      provider: normalizedProvider,
      currentOnly: false,
      limit: 500,
    }),
    readWorkspaceStore(),
  ]);

  const providerBaseHistory = baseHistory.filter(
    (item) => item.templateKey === normalizedProvider,
  );
  const baseCurrent =
    providerBaseHistory.find((item) => item.isCurrent) ?? providerBaseHistory[0] ?? null;
  const packageCurrent =
    packageHistory.find((item) => item.isCurrent) ?? packageHistory[0] ?? null;
  const draft = store.providers?.[normalizedProvider] ?? null;

  return {
    provider: normalizedProvider,
    draft,
    baseCurrent,
    packageCurrent,
    baseHistory: providerBaseHistory,
    packageHistory,
    hasDraftChanges: buildHasChanges(draft, baseCurrent, packageCurrent),
  };
}

export async function listAiTemplateWorkspaces() {
  const store = await readWorkspaceStore();
  const [baseHistory, packageHistory] = await Promise.all([
    listAiTemplateBases({ currentOnly: false, limit: 500 }),
    listAiProviderTemplatePackages({ currentOnly: false, limit: 500 }),
  ]);

  return MANAGED_AI_PROVIDERS.map((provider) => {
    const providerBaseHistory = baseHistory.filter((item) => item.templateKey === provider);
    const providerPackageHistory = packageHistory.filter((item) => item.provider === provider);
    const baseCurrent =
      providerBaseHistory.find((item) => item.isCurrent) ?? providerBaseHistory[0] ?? null;
    const packageCurrent =
      providerPackageHistory.find((item) => item.isCurrent) ??
      providerPackageHistory[0] ??
      null;
    const draft = store.providers?.[provider] ?? null;

    return {
      provider,
      displayName: getManagedAiProviderDefinition(provider)?.displayName || provider,
      draftExists: Boolean(draft),
      hasDraftChanges: buildHasChanges(draft, baseCurrent, packageCurrent),
      draftUpdatedAt: draft?.updatedAt ?? null,
      publishedBaseVersion: baseCurrent?.version ?? null,
      publishedPackageVersion: packageCurrent?.version ?? null,
    };
  });
}

export async function getAiTemplateWorkspace(provider) {
  return getProviderContext(provider);
}

export async function saveAiTemplateWorkspaceDraft(provider, payload = {}) {
  const context = await getProviderContext(provider);
  const store = await readWorkspaceStore();
  const draft = buildDraftPayload(context.provider, {
    ...context.draft,
    ...payload,
    basedOnBaseVersion: context.baseCurrent?.version ?? null,
    basedOnPackageVersion: context.packageCurrent?.version ?? null,
  });

  store.providers[context.provider] = draft;
  await writeWorkspaceStore(store);

  return {
    message: 'Rascunho salvo com sucesso.',
    data: {
      ...(await getProviderContext(context.provider)),
    },
  };
}

export async function discardAiTemplateWorkspaceDraft(provider) {
  const normalizedProvider = normalizeProvider(provider);
  const store = await readWorkspaceStore();
  delete store.providers[normalizedProvider];
  await writeWorkspaceStore(store);

  return {
    message: 'Rascunho descartado com sucesso.',
    data: await getProviderContext(normalizedProvider),
  };
}

export async function releaseAiTemplateWorkspaceDraft(provider, input = {}) {
  const context = await getProviderContext(provider);
  if (!input?.confirmRelease) {
    throw new Error('Confirmacao obrigatoria para liberar em producao.');
  }

  if (!context.draft) {
    throw new Error('Nao existe rascunho salvo para publicar.');
  }

  const scope = normalizeReleaseScope(input.scope);
  const messages = [];

  const baseChanged =
    context.draft.baseTemplateContent !== (context.baseCurrent?.templateContent ?? '');
  const packageChanged = buildPackageDraftDiff(context.draft, context.packageCurrent);

  if ((scope === 'all' || scope === 'base') && baseChanged) {
    const response = await saveAiTemplateBase({
      templateKey: context.provider,
      templateName: context.draft.baseTemplateName || context.baseCurrent?.templateName,
      templateContent: context.draft.baseTemplateContent,
      contentType: context.draft.contentType || context.baseCurrent?.contentType,
      sourcePath: context.draft.sourcePath ?? context.baseCurrent?.sourcePath ?? null,
      isActive: true,
    });
    messages.push(response.changed ? 'Template base publicado.' : 'Template base sem alteracoes.');
  }

  if (
    (scope === 'all' && packageChanged) ||
    (scope !== 'all' && scope !== 'base' && context.draft[COMPONENT_FIELD_MAP[scope]] !== (context.packageCurrent?.[COMPONENT_FIELD_MAP[scope]] ?? ''))
  ) {
    const response = await saveAiProviderTemplatePackage(
      context.provider,
      buildPackageReleasePayload(context, scope === 'all' ? null : scope),
    );
    messages.push(
      scope === 'all'
        ? response.changed
          ? 'Pacote de fluxos publicado.'
          : 'Pacote de fluxos sem alteracoes.'
        : response.changed
          ? `Fluxo ${scope} publicado.`
          : `Fluxo ${scope} sem alteracoes.`,
    );
  }

  return {
    message:
      messages.join(' ') ||
      (scope === 'all'
        ? 'Nada foi alterado em producao.'
        : `Nenhuma alteracao pendente para o escopo ${scope}.`),
    data: await persistWorkspaceAfterScopedRelease(context, scope),
  };
}

export async function rollbackAiTemplateWorkspace(provider, input = {}) {
  const context = await getProviderContext(provider);
  if (!input?.confirmRelease) {
    throw new Error('Confirmacao obrigatoria para rollback em producao.');
  }

  const baseVersion = Number(input.baseVersion || 0) || null;
  const packageVersion = Number(input.packageVersion || 0) || null;

  if (!baseVersion && !packageVersion) {
    throw new Error('Informe baseVersion e/ou packageVersion para rollback.');
  }

  const messages = [];

  if (baseVersion) {
    const baseTarget = context.baseHistory.find((item) => item.version === baseVersion);
    if (!baseTarget) {
      throw new Error(`Versao base nao encontrada: v${baseVersion}`);
    }

    const response = await saveAiTemplateBase({
      templateKey: context.provider,
      templateName: baseTarget.templateName,
      templateContent: baseTarget.templateContent,
      contentType: baseTarget.contentType,
      sourcePath: baseTarget.sourcePath,
      isActive: baseTarget.isActive,
    });
    messages.push(
      response.changed
        ? `Rollback do template base para v${baseVersion} publicado.`
        : `Template base ja estava equivalente a v${baseVersion}.`,
    );
  }

  if (packageVersion) {
    const packageTarget = context.packageHistory.find((item) => item.version === packageVersion);
    if (!packageTarget) {
      throw new Error(`Versao do pacote de fluxos nao encontrada: v${packageVersion}`);
    }

    const response = await saveAiProviderTemplatePackage(
      context.provider,
      buildReleasePayloadFromPackage(packageTarget),
    );
    messages.push(
      response.changed
        ? `Rollback do pacote de fluxos para v${packageVersion} publicado.`
        : `Pacote de fluxos ja estava equivalente a v${packageVersion}.`,
    );
  }

  const store = await readWorkspaceStore();
  delete store.providers[context.provider];
  await writeWorkspaceStore(store);

  return {
    message: messages.join(' '),
    data: await getProviderContext(context.provider),
  };
}
