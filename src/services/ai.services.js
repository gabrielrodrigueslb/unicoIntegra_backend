import {
  alpha7Functions,
  trierFunctions,
  vannonFunctions,
  vectorFunctions,
} from './aiFunctions.js';
import {
  buildManagedAiTemplateVariables,
  createManagedAiConfigSnapshot,
  isManagedAiComponentKey,
  getManagedAiUpdateOrder,
  isManagedAiProvider,
  isAiProviderUpdateBlocked,
} from './aiProviderCatalog.js';
import {
  getCurrentAiProviderTemplatePackageWithOptions,
  loadAiProviderTemplateComponent,
} from './aiProviderTemplate.services.js';
import {
  getAiClientInstallationById,
  listAiClientInstallations,
  setAiClientInstallationSyncStatus,
  upsertAiClientInstallation,
} from './aiClientInstallations.services.js';
import { loadAiTemplateFromDbOrFile } from './aiTemplateBase.services.js';
import {
  authenticateInstance,
  createAssistantItem,
  getIvr,
  postIvr,
  updateAssistantItem,
  updateIvr,
} from './instanceApi.services.js';
import { loadAndParseTemplate } from './TemplateService.js';
import { createAiVersionSnapshot } from './aiVersion.services.js';

const MANAGED_PROVIDER_INSTALLERS = {
  alpha7: alpha7Functions,
  trier: trierFunctions,
  vannon: vannonFunctions,
  vetor: vectorFunctions,
};

const COMPONENT_ID_FIELD_BY_KEY = {
  downloadImagem: 'downloadImagemId',
  buscaProdutos: 'buscaProdutosId',
  ura: 'uraIaId',
  uraAb: 'uraAbId',
  preProcess: 'preProcessId',
};

function normalizeRequestedComponentKeys(componentKey) {
  if (componentKey === undefined || componentKey === null || componentKey === '') {
    return [];
  }

  const values = Array.isArray(componentKey) ? componentKey : [componentKey];
  const normalized = values
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  for (const key of normalized) {
    if (!isManagedAiComponentKey(key)) {
      throw new Error(`Componente de IA invalido: ${key}`);
    }

    if (key === 'ura' || key === 'uraAb') {
      throw new Error(
        'URA IA e URA AB nao participam do fluxo de atualizacao automatica.',
      );
    }
  }

  return [...new Set(normalized)];
}

function toReadableInstanceError(error) {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message;
    }

    if (typeof responseData.error === 'string' && responseData.error.trim()) {
      return responseData.error;
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      return error?.message || 'Erro interno ao processar a IA.';
    }
  }

  return error?.message || 'Erro interno ao processar a IA.';
}

async function tryCreateAiVersionSnapshot(instance, payload) {
  try {
    await createAiVersionSnapshot(instance, payload);
  } catch (error) {
    console.warn(
      'AI_VERSION WARN: Falha ao versionar IA. Operacao principal concluida sem snapshot.',
      error?.message || error,
    );
  }
}

function buildManagedInstallationIds(record) {
  return {
    preProcessId: record.preProcessId,
    buscaProdutosId: record.buscaProdutosId,
    downloadImagemId: record.downloadImagemId,
    uraIaId: record.uraIaId,
    uraAbId: record.uraAbId,
  };
}

async function buildManagedAssistantPayload(provider, installationRecord) {
  const ids = buildManagedInstallationIds(installationRecord);
  const variables = buildManagedAiTemplateVariables(provider, {
    instance: installationRecord.instance,
    assistantId: installationRecord.assistantId,
    config: installationRecord.configSnapshot || {},
    ids,
  });

  const assistantPayload = await loadAiProviderTemplateComponent(
    provider,
    'assistant',
    variables,
    { requireDatabase: true },
  );

  const numericAssistantId = Number(installationRecord.assistantId);
  assistantPayload.id = Number.isFinite(numericAssistantId)
    ? numericAssistantId
    : installationRecord.assistantId;
  return assistantPayload;
}

async function buildManagedIvrPayload(provider, componentKey, installationRecord) {
  const ids = buildManagedInstallationIds(installationRecord);
  const variables = buildManagedAiTemplateVariables(provider, {
    instance: installationRecord.instance,
    assistantId: installationRecord.assistantId,
    config: installationRecord.configSnapshot || {},
    ids,
  });

  return loadAiProviderTemplateComponent(provider, componentKey, variables, {
    requireDatabase: true,
  });
}

async function createManagedIntegratedAi({ provider, auth, configInput }) {
  const installArtifacts = MANAGED_PROVIDER_INSTALLERS[provider];
  if (!installArtifacts) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  const currentPackage = await getCurrentAiProviderTemplatePackageWithOptions(provider, {
    requireDatabase: true,
  });
  if (!currentPackage) {
    throw new Error(`Pacote atual do provider ${provider} nao encontrado.`);
  }

  const token = await authenticateInstance(
    auth.instance,
    auth.username,
    auth.password,
    auth.code2fa,
  );

  const aiData = await createAi(auth.instance, token);
  const assistantId = aiData.id;
  const configSnapshot = createManagedAiConfigSnapshot(provider, configInput);

  const installedIds = await installArtifacts({
    instance: auth.instance,
    token,
    iaId: assistantId,
    configSnapshot,
  });

  const assistantVariables = buildManagedAiTemplateVariables(provider, {
    instance: auth.instance,
    assistantId,
    config: configSnapshot,
    ids: installedIds,
  });

  const assistantPayload = await loadAiProviderTemplateComponent(
    provider,
    'assistant',
    assistantVariables,
    { requireDatabase: true },
  );

  assistantPayload.id = assistantId;

  try {
    const response = await updateAssistantItem(
      auth.instance,
      assistantPayload,
      token,
    );

    await upsertAiClientInstallation({
      instance: auth.instance,
      provider,
      assistantId,
      assistantName: assistantPayload.name || configSnapshot.assistantDisplayName || null,
      installedVersion: currentPackage.version,
      installedComponentVersions: currentPackage.componentVersions,
      source: 'managed',
      configSnapshot,
      preProcessId: installedIds.preProcessId,
      buscaProdutosId: installedIds.buscaProdutosId,
      downloadImagemId: installedIds.downloadImagemId,
      uraIaId: installedIds.uraIaId,
      uraAbId: installedIds.uraAbId,
      lastSyncStatus: 'installed',
      lastSyncError: null,
    });

    await tryCreateAiVersionSnapshot(auth.instance, assistantPayload);
    return response;
  } catch (error) {
    console.error(
      `Falha ao configurar a IA ${provider}:`,
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

function shouldSkipInstallationUpdate(record, force = false) {
  if (force) return false;
  if (record.currentVersion === null) return false;
  if (record.installedVersion === null) return false;
  return Number(record.installedVersion) >= Number(record.currentVersion);
}

function getInstalledComponentVersion(record, componentKey) {
  return Number(record.installedComponentVersions?.[componentKey]);
}

function getCurrentComponentVersion(templatePackage, componentKey) {
  return Number(templatePackage?.componentVersions?.[componentKey]);
}

function resolveComponentsToUpdate({
  installation,
  currentPackage,
  requestedComponentKeys = [],
  force = false,
}) {
  const candidateKeys =
    requestedComponentKeys.length > 0
      ? requestedComponentKeys
      : [...new Set([...getManagedAiUpdateOrder(installation.provider), 'assistant'])];

  return candidateKeys.filter((componentKey) => {
    if (force) return true;

    const currentVersion = getCurrentComponentVersion(currentPackage, componentKey);
    if (!Number.isFinite(currentVersion)) return false;

    const installedVersion = getInstalledComponentVersion(installation, componentKey);
    if (!Number.isFinite(installedVersion)) return true;

    return currentVersion > installedVersion;
  });
}

export async function createAi(instance, token) {
  try {
    if (!instance) {
      throw new Error('Informe a instancia para criar a IA.');
    }

    const installResponse = await createAssistantItem(
      instance,
      { name: 'Novo assistente' },
      token,
    );

    console.log('IA criada com sucesso!:', installResponse);
    return installResponse;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function createAiAlpha({
  instance,
  username,
  password,
  code2fa,
  name,
  nome_cliente,
  porta_cliente,
  unidade_negocio,
  apiKey,
}) {
  return createManagedIntegratedAi({
    provider: 'alpha7',
    auth: { instance, username, password, code2fa },
    configInput: {
      name,
      nome_cliente,
      porta_cliente,
      unidade_negocio,
      apiKey,
    },
  });
}

export async function createAiTrier({
  instance,
  username,
  password,
  code2fa,
  name,
  nome_cliente,
  porta_cliente,
  apiKey,
}) {
  return createManagedIntegratedAi({
    provider: 'trier',
    auth: { instance, username, password, code2fa },
    configInput: {
      name,
      nome_cliente,
      porta_cliente,
      apiKey,
    },
  });
}

export async function createAiVannon(
  instance,
  username,
  password,
  code2fa,
  name,
  clientEndpoint,
  clientName,
  apiKey,
  cepLoja,
) {
  return createManagedIntegratedAi({
    provider: 'vannon',
    auth: { instance, username, password, code2fa },
    configInput: {
      name,
      clientEndpoint,
      clientName,
      apiKey,
      cepLoja,
    },
  });
}

export async function createAiVetor(
  instance,
  username,
  password,
  code2fa,
  name,
  vetorToken,
  unidade_negocio_vetor,
  clientName,
  apiKey,
) {
  return createManagedIntegratedAi({
    provider: 'vetor',
    auth: { instance, username, password, code2fa },
    configInput: {
      name,
      vetorToken,
      unidade_negocio_vetor,
      clientName,
      apiKey,
    },
  });
}

export async function createDefaultAi(
  instance,
  username,
  password,
  code2fa,
  name,
  context,
) {
  const token = await authenticateInstance(instance, username, password, code2fa);

  let installResponse;
  let aiData;
  let uraIaResponse;
  let uraAbResponse;

  try {
    const automationPayload = await loadAndParseTemplate(
      'default_pre_automation.json',
      {},
    );

    installResponse = await postIvr(instance, automationPayload, token);
  } catch (error) {
    console.error(
      'Falha instalar o pre processador:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }

  try {
    aiData = await createAi(instance, token);
  } catch (error) {
    throw error;
  }

  try {
    const uraPayload = await loadAndParseTemplate(
      'ia/default_atendimento_ura.json',
      {
        ia_id: aiData.id,
      },
    );

    uraIaResponse = await postIvr(instance, uraPayload, token);
  } catch (error) {
    console.error(
      'Falha ao instalar a URA IA da IA de atendimento:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }

  try {
    const uraAbPayload = await loadAndParseTemplate(
      'ia/default_atendimento_ura_ab.json',
      {
        ura_ia_id: uraIaResponse.id,
      },
    );

    uraAbResponse = await postIvr(instance, uraAbPayload, token);
  } catch (error) {
    console.error(
      'Falha ao instalar a URA AB da IA de atendimento:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }

  try {
    const iaPayload = await loadAiTemplateFromDbOrFile(
      'atendimento',
      {
        id: aiData.id,
        name: `${name}`,
        signaturename: name,
        context,
        preautomation: installResponse.id,
      },
      'ia/default_atendimento_ia_config.json',
      { requireDatabase: true },
    );

    const createAiResponse = await updateAssistantItem(
      instance,
      iaPayload,
      token,
    );

    const installationRecord = await upsertAiClientInstallation({
      instance,
      provider: 'atendimento',
      assistantId: aiData.id,
      assistantName: iaPayload.name || name,
      installedVersion: 1,
      source: 'managed',
      configSnapshot: {
        assistantDisplayName: name,
        context,
      },
      installedComponentVersions: null,
      preProcessId: installResponse.id,
      buscaProdutosId: null,
      downloadImagemId: null,
      uraIaId: uraIaResponse.id,
      uraAbId: uraAbResponse.id,
      lastSyncStatus: 'installed',
      lastSyncError: null,
    });

    await tryCreateAiVersionSnapshot(instance, iaPayload);
    return {
      ...createAiResponse,
      supportFlows: {
        preProcessId: String(installResponse.id),
        uraIaId: String(uraIaResponse.id),
        uraAbId: String(uraAbResponse.id),
      },
      installation: installationRecord,
    };
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function listManagedAiInstallations(filters = {}) {
  return listAiClientInstallations(filters);
}

export async function updateManagedAiInstallation({
  installationId,
  username,
  password,
  code2fa,
  force = false,
  componentKey,
}) {
  const installation = await getAiClientInstallationById(installationId);
  if (!installation) {
    throw new Error('Instalacao de IA nao encontrada.');
  }

  if (isAiProviderUpdateBlocked(installation.provider)) {
    throw new Error(
      'A IA de atendimento personalizada nao participa do fluxo de atualizacao automatica.',
    );
  }

  if (!isManagedAiProvider(installation.provider)) {
    throw new Error('Esta instalacao nao pertence a um provider gerenciado.');
  }

  if (!installation.canUpdate) {
    throw new Error(
      'Esta instalacao nao possui dados suficientes para atualizar. Complete os IDs e a configuracao primeiro.',
    );
  }

  const currentPackage = await getCurrentAiProviderTemplatePackageWithOptions(
    installation.provider,
    { requireDatabase: true },
  );
  if (!currentPackage) {
    throw new Error(
      `Pacote atual do provider ${installation.provider} nao encontrado.`,
    );
  }

  const requestedComponentKeys = normalizeRequestedComponentKeys(componentKey);
  const componentsToUpdate = resolveComponentsToUpdate({
    installation,
    currentPackage,
    requestedComponentKeys,
    force,
  });

  if (requestedComponentKeys.length > 0 && componentsToUpdate.length === 0) {
    return {
      updated: false,
      message: 'Nenhum dos componentes solicitados precisa de atualizacao.',
      installation,
    };
  }

  if (componentsToUpdate.length === 0 && shouldSkipInstallationUpdate(installation, force)) {
    return {
      updated: false,
      message: 'A instalacao ja esta na versao atual.',
      installation,
    };
  }

  const token = await authenticateInstance(
    installation.instance,
    username,
    password,
    code2fa,
  );

  try {
    for (const componentKey of componentsToUpdate.filter((item) => item !== 'assistant')) {
      const payload = await buildManagedIvrPayload(
        installation.provider,
        componentKey,
        installation,
      );

      const componentIdField = COMPONENT_ID_FIELD_BY_KEY[componentKey];
      await updateIvr(
        installation.instance,
        installation[componentIdField],
        payload,
        token,
      );
    }

    let assistantResponse = null;
    if (componentsToUpdate.includes('assistant')) {
      const assistantPayload = await buildManagedAssistantPayload(
        installation.provider,
        installation,
      );

      assistantResponse = await updateAssistantItem(
        installation.instance,
        assistantPayload,
        token,
      );

      await tryCreateAiVersionSnapshot(installation.instance, assistantPayload);
    }

    const nextInstalledComponentVersions = {
      ...(installation.installedComponentVersions || {}),
    };

    for (const key of componentsToUpdate) {
      const currentComponentVersion = getCurrentComponentVersion(currentPackage, key);
      if (Number.isFinite(currentComponentVersion)) {
        nextInstalledComponentVersions[key] = currentComponentVersion;
      }
    }

    const updatedInstallation = await setAiClientInstallationSyncStatus(
      installation.id,
      {
        installedVersion: currentPackage.version,
        installedComponentVersions: nextInstalledComponentVersions,
        lastSyncStatus: 'updated',
        lastSyncError: null,
      },
    );

    return {
      updated: true,
      message: 'Atualizacao concluida com sucesso.',
      installation: updatedInstallation,
      updatedComponents: componentsToUpdate,
      assistantResponse,
    };
  } catch (error) {
    const readableError = toReadableInstanceError(error);

    await setAiClientInstallationSyncStatus(installation.id, {
      lastSyncStatus: 'update_error',
      lastSyncError: readableError,
    });

    throw new Error(readableError);
  }
}

export async function updateAllManagedAiInstallations({
  username,
  password,
  code2fa,
  instance,
  provider,
  force = false,
  componentKey,
} = {}) {
  const installations = await listAiClientInstallations({
    instance,
    provider,
    limit: 5000,
  });

  const managedInstallations = installations.filter((item) =>
    isManagedAiProvider(item.provider) && !isAiProviderUpdateBlocked(item.provider),
  );

  const results = [];
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const item of managedInstallations) {
    if (!item.canUpdate) {
      skippedCount += 1;
      results.push({
        id: item.id,
        instance: item.instance,
        provider: item.provider,
        assistantName: item.assistantName,
        updated: false,
        success: true,
        skipped: true,
        message:
          'Instalacao ignorada: faltam IDs/componentes ou configuracao para atualizacao automatica.',
        updatedComponents: [],
      });
      continue;
    }

    try {
      const result = await updateManagedAiInstallation({
        installationId: item.id,
        username,
        password,
        code2fa,
        force,
        componentKey,
      });

      if (result.updated) {
        updatedCount += 1;
      }

      results.push({
        id: item.id,
        instance: item.instance,
        provider: item.provider,
        assistantName: item.assistantName,
        updated: result.updated,
        success: true,
        skipped: false,
        message: result.message,
        updatedComponents: result.updatedComponents || [],
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        id: item.id,
        instance: item.instance,
        provider: item.provider,
        assistantName: item.assistantName,
        updated: false,
        success: false,
        skipped: false,
        message: error.message || 'Falha ao atualizar a instalacao.',
      });
    }
  }

  return {
    total: managedInstallations.length,
    updated: updatedCount,
    failed: failedCount,
    skipped: skippedCount,
    results,
  };
}

export async function patchManagedAiUraQuantity({
  installationId,
  username,
  password,
  code2fa,
  quantidadeDeProdutos = 3,
}) {
  const installation = await getAiClientInstallationById(installationId);
  if (!installation) {
    throw new Error('Instalacao de IA nao encontrada.');
  }

  if (installation.provider !== 'alpha7') {
    throw new Error(
      'O patch seguro da URA esta disponivel apenas para instalacoes alpha7.',
    );
  }

  if (!installation.uraIaId) {
    throw new Error('A instalacao nao possui uraIaId configurado.');
  }

  const quantidadeNormalizada = Number(quantidadeDeProdutos);
  if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 1) {
    throw new Error('A quantidade de produtos deve ser maior que zero.');
  }

  const quantidadeFinal = Math.min(7, quantidadeNormalizada);

  const token = await authenticateInstance(
    installation.instance,
    username,
    password,
    code2fa,
  );

  const currentUra = await getIvr(
    installation.instance,
    installation.uraIaId,
    token,
  );

  const options = parseIvrOptions(currentUra?.options);
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error('Nao foi possivel ler os blocos atuais da URA.');
  }

  const firstScriptBlock =
    options.find(
      (item) =>
        String(item?.id || '') === String(currentUra?.initialtext || '') &&
        Number(item?.type) === 21,
    ) || options.find((item) => Number(item?.type) === 21);

  if (!firstScriptBlock?.config || typeof firstScriptBlock.config !== 'object') {
    throw new Error('Nao foi possivel localizar o primeiro JavaScript da URA.');
  }

  const previousCode = String(firstScriptBlock.config.code || '');
  const nextCode = patchUraFirstScriptCode(previousCode, quantidadeFinal);

  if (nextCode === previousCode) {
    return {
      updated: false,
      message: 'A URA ja possui esse valor configurado.',
      installation,
      quantidade_de_produtos: quantidadeFinal,
    };
  }

  firstScriptBlock.config.code = nextCode;

  const updatedUraPayload = {
    ...currentUra,
    options: stringifyIvrOptions(options),
  };

  await updateIvr(
    installation.instance,
    installation.uraIaId,
    updatedUraPayload,
    token,
  );

  const updatedInstallation = await upsertAiClientInstallation({
    instance: installation.instance,
    provider: installation.provider,
    assistantId: installation.assistantId,
    assistantName: installation.assistantName,
    installedVersion: installation.installedVersion,
    source: installation.source,
    configSnapshot: {
      ...(installation.configSnapshot || {}),
      quantidade_de_produtos: quantidadeFinal,
    },
    installedComponentVersions: installation.installedComponentVersions,
    preProcessId: installation.preProcessId,
    buscaProdutosId: installation.buscaProdutosId,
    downloadImagemId: installation.downloadImagemId,
    uraIaId: installation.uraIaId,
    uraAbId: installation.uraAbId,
    lastSyncStatus: 'updated',
    lastSyncError: null,
  });

  return {
    updated: true,
    message: 'Patch seguro aplicado na URA com sucesso.',
    installation: updatedInstallation,
    quantidade_de_produtos: quantidadeFinal,
  };
}

function parseIvrOptions(options) {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options === 'string' && options.trim()) {
    return JSON.parse(options);
  }

  return [];
}

function stringifyIvrOptions(options) {
  return JSON.stringify(options);
}

function patchUraFirstScriptCode(code, quantidadeDeProdutos) {
  const currentCode = String(code || '');
  const nextLine = `vars['qtd_produtos'] = ${quantidadeDeProdutos}`;

  if (currentCode.includes("vars['qtd_produtos']")) {
    return currentCode.replace(/vars\['qtd_produtos'\]\s*=\s*.*$/m, nextLine);
  }

  if (currentCode.includes("vars['unidade_negocio_var']")) {
    return currentCode.replace(
      /(vars\['unidade_negocio_var'\]\s*=\s*.*)/,
      `$1\n${nextLine}`,
    );
  }

  return `${currentCode}\n${nextLine}`.trim();
}
