import axios from 'axios';
import loginInstance from './loginInstance.js';
import { alpha7Functions, vannonFunctions } from './aiFunctions.js';
import { loadAiTemplateFromDbOrFile } from './aiTemplateBase.services.js';
import { createAiVersionSnapshot } from './aiVersion.services.js';
import { loadAndParseTemplate } from './TemplateService.js'; // Importação nova

export async function createAi(instance, token) {
  try {
    if (!instance) {
      throw new Error('Informe a instância para criar a IA.');
    }
    // Criação inicial básica (Item placeholder)
    const installResponse = await axios.post(
      `${instance}/assistants/createItem`,
      { name: 'Novo assistente' },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log('IA criada com sucesso!:', installResponse.data);
    return installResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}

export async function createAiAlpha(
  instance,
  username,
  password,
  code2fa,
  name,
  context,
  clientIp,
  clientPort,
  unidade_negocio,
  apiKey,
  queueId,
) {
  const loginData = await loginInstance(instance, username, password, code2fa);

  // 1. Cria a IA em branco para pegar o ID
  const aiData = await createAi(instance, loginData.token);
  const iaId = aiData.id;

  // 2. Roda as funções auxiliares (IVRs)
  const ivrIds = await alpha7Functions(
    instance,
    loginData.token,
    clientIp,
    clientPort,
    unidade_negocio,
    apiKey,
    queueId,
    iaId,
  );

  // 3. Carrega o Template da IA configurada
  // Note que passamos os IDs retornados pela alpha7Functions
  const iaPayload = await loadAiTemplateFromDbOrFile('alpha7', {
    id: aiData.id,
    signaturename: name,
    context: context || 'Você é um assistente...', // Fallback se context for null
    preProcessId: ivrIds.preProcessId,
    FiltraProdutoItemId: ivrIds.FiltraProdutoItemId,
    BuscaItensId: ivrIds.BuscaItensId,
  }, 'ia/alpha7_ia_config.json');

  // O payload do template não tem o ID da IA criado no passo 1, precisamos injetar ou garantir que o updateItem use o ID da URL/Body
  iaPayload.id = aiData.id;

  try {
    const createAlphaAiResponse = await axios.post(
      `${instance}/assistants/updateItem`,
      iaPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );
    console.log(
      'IA Alpha7 configurada com sucesso!:',
      createAlphaAiResponse.data,
    );
    await createAiVersionSnapshot(instance, iaPayload);
    return createAlphaAiResponse.data;
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
  cepLoja
) {
  const loginData = await loginInstance(instance, username, password, code2fa);

  // 1. Cria a IA em branco para pegar o ID
  const aiData = await createAi(instance, loginData.token);
  const iaId = aiData.id;

  // 2. Roda as funções auxiliares (IVRs)
  const ivrIds = await vannonFunctions(
    instance,
    loginData.token,
    clientEndpoint,
    clientName,
    apiKey,
    queueId,
    iaId,
    cepLoja,
  );

  // 3. Carrega o Template da IA configurada
  // Note que passamos os IDs retornados pela alpha7Functions
  const iaPayload = await loadAiTemplateFromDbOrFile('vannon', {
    id: aiData.id,
    signaturename: name,
    context: context || 'Você é um assistente...', // Fallback se context for null
    preProcessId: ivrIds.preProcessId,
    envioItensId: ivrIds.envioItensId,
    transfereId: ivrIds.transfereId,
  }, 'ia/vannon/Vannon_ai_config.json');

  // O payload do template não tem o ID da IA criado no passo 1, precisamos injetar ou garantir que o updateItem use o ID da URL/Body
  iaPayload.id = aiData.id;

  try {
    const createAlphaAiResponse = await axios.post(
      `${instance}/assistants/updateItem`,
      iaPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );
    console.log(
      'IA Vannon configurada com sucesso!:',
      createAlphaAiResponse.data,
    );
    await createAiVersionSnapshot(instance, iaPayload);
    return createAlphaAiResponse.data;
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
  const loginData = await loginInstance(instance, username, password, code2fa);

  let installResponse;
  let aiData;

  // 1️⃣ Cria o pré-processamento (Carregando do JSON)
  try {
    const automationPayload = await loadAndParseTemplate(
      'default_pre_automation.json',
      {},
    );

    installResponse = await axios.post(`${instance}/ivrs/`, automationPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
    });
  } catch (error) {
    console.error(
      'Falha instalar o pré processador:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }

  // 2️⃣ Cria a IA base
  try {
    aiData = await createAi(instance, loginData.token);
  } catch (error) {
    throw error;
  }

  // 3️⃣ Atualiza a IA com a automation (Aqui você pode criar outro template se quiser 'default_ia_config.json' ou manter inline se for simples)
  try {
    const iaPayload = await loadAiTemplateFromDbOrFile(
      'atendimento',
      {
        id: aiData.id,
        name: `${name}`,
        signaturename: name,
        context,
        preautomation: installResponse.data.id,
      },
      'ia/default_atendimento_ia_config.json',
    );

    const createAiResponse = await axios.post(
      `${instance}/assistants/updateItem`,
      iaPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );

    await createAiVersionSnapshot(instance, iaPayload);
    return createAiResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}
