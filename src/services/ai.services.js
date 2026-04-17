import {
  alpha7Functions,
  trierFunctions,
  vannonFunctions,
  vectorFunctions,
} from './aiFunctions.js';
import {
  buildManagedAiTemplateVariables,
  createManagedAiConfigSnapshot,
  getManagedAiInstallOrder,
  getManagedAiUpdateOrder,
  isManagedAiProvider,
  isAiProviderUpdateBlocked,
} from './aiProviderCatalog.js';
import {
  getCurrentAiProviderTemplatePackage,
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

  return loadAiProviderTemplateComponent(provider, componentKey, variables);
}

async function createManagedIntegratedAi({ provider, auth, configInput }) {
  const installArtifacts = MANAGED_PROVIDER_INSTALLERS[provider];
  if (!installArtifacts) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  const currentPackage = await getCurrentAiProviderTemplatePackage(provider);
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
  clientName,
  apiKey,
) {
  return createManagedIntegratedAi({
    provider: 'vetor',
    auth: { instance, username, password, code2fa },
    configInput: {
      name,
      vetorToken,
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
    );

    const createAiResponse = await updateAssistantItem(
      instance,
      iaPayload,
      token,
    );

    await tryCreateAiVersionSnapshot(instance, iaPayload);
    return createAiResponse;
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

  if (shouldSkipInstallationUpdate(installation, force)) {
    return {
      updated: false,
      message: 'A instalacao ja esta na versao atual.',
      installation,
    };
  }

  const currentPackage = await getCurrentAiProviderTemplatePackage(
    installation.provider,
  );
  if (!currentPackage) {
    throw new Error(
      `Pacote atual do provider ${installation.provider} nao encontrado.`,
    );
  }

  const token = await authenticateInstance(
    installation.instance,
    username,
    password,
    code2fa,
  );

  try {
    for (const componentKey of getManagedAiUpdateOrder(installation.provider)) {
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

    const assistantPayload = await buildManagedAssistantPayload(
      installation.provider,
      installation,
    );

    const assistantResponse = await updateAssistantItem(
      installation.instance,
      assistantPayload,
      token,
    );

    const updatedInstallation = await setAiClientInstallationSyncStatus(
      installation.id,
      {
        installedVersion: currentPackage.version,
        lastSyncStatus: 'updated',
        lastSyncError: null,
      },
    );

    await tryCreateAiVersionSnapshot(installation.instance, assistantPayload);

    return {
      updated: true,
      message: 'Atualizacao concluida com sucesso.',
      installation: updatedInstallation,
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

  for (const item of managedInstallations) {
    try {
      const result = await updateManagedAiInstallation({
        installationId: item.id,
        username,
        password,
        code2fa,
        force,
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
        message: result.message,
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
        message: error.message || 'Falha ao atualizar a instalacao.',
      });
    }
  }

  return {
    total: managedInstallations.length,
    updated: updatedCount,
    failed: failedCount,
    results,
  };
}
