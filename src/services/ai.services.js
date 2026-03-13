import { alpha7Functions, vannonFunctions } from './aiFunctions.js';
import { loadAiTemplateFromDbOrFile } from './aiTemplateBase.services.js';
import {
  authenticateInstance,
  createAssistantItem,
  postIvr,
  updateAssistantItem,
} from './instanceApi.services.js';
import { loadAndParseTemplate } from './TemplateService.js';
import { createAiVersionSnapshot } from './aiVersion.services.js';

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

export async function createAi(instance, token) {
  try {
    if (!instance) {
      throw new Error('Informe a instância para criar a IA.');
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
  const token = await authenticateInstance(instance, username, password, code2fa);

  const aiData = await createAi(instance, token);
  const iaId = aiData.id;

  const ivrIds = await alpha7Functions({
    instance,
    token,
    nome_cliente,
    porta_cliente,
    unidade_negocio,
    apiKey,
    iaId,
  });

  const iaPayload = await loadAiTemplateFromDbOrFile(
    'alpha7',
    {
      id: aiData.id,
      signaturename: name,
      nome_cliente,
      preProcessId: ivrIds.preProcessId,
      BuscaItensId: ivrIds.BuscaItensId,
    },
    'ia/alpha7/alpha_ia_config.json',
  );

  iaPayload.id = aiData.id;

  try {
    const createAlphaAiResponse = await updateAssistantItem(
      instance,
      iaPayload,
      token,
    );
    console.log('IA Alpha7 configurada com sucesso!:', createAlphaAiResponse);
    await tryCreateAiVersionSnapshot(instance, iaPayload);
    return createAlphaAiResponse;
  } catch (error) {
    console.error(
      'Falha ao configurar a IA Alpha7:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function createAiVannon(
  instance,
  username,
  password,
  code2fa,
  name,
  context,
  clientEndpoint,
  clientName,
  apiKey,
  queueId,
  cepLoja,
) {
  const token = await authenticateInstance(instance, username, password, code2fa);

  const aiData = await createAi(instance, token);
  const iaId = aiData.id;

  const ivrIds = await vannonFunctions(
    instance,
    token,
    clientEndpoint,
    clientName,
    apiKey,
    queueId,
    iaId,
    cepLoja,
  );

  const iaPayload = await loadAiTemplateFromDbOrFile(
    'vannon',
    {
      id: aiData.id,
      signaturename: name,
      context: context || 'Você é um assistente...',
      preProcessId: ivrIds.preProcessId,
      envioItensId: ivrIds.envioItensId,
      transfereId: ivrIds.transfereId,
    },
    'ia/vannon/Vannon_ai_config.json',
  );

  iaPayload.id = aiData.id;

  try {
    const createAlphaAiResponse = await updateAssistantItem(
      instance,
      iaPayload,
      token,
    );
    console.log('IA Vannon configurada com sucesso!:', createAlphaAiResponse);
    await tryCreateAiVersionSnapshot(instance, iaPayload);
    return createAlphaAiResponse;
  } catch (error) {
    console.error(
      'Falha ao configurar a IA Vannon:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
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
      'Falha instalar o pré processador:',
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
