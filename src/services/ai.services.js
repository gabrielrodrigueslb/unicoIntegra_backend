import axios from 'axios';
import loginInstance from './loginInstance.js';
import { alpha7Functions } from './aiFunctions.js';
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
  dbName,
  queueId,
  apiKey,
) {
  console.log('Primeira req de login');
  const loginData = await loginInstance(instance, username, password, code2fa);
  
  // 1. Cria a IA em branco para pegar o ID
  const aiData = await createAi(instance, loginData.token);

  // 2. Roda as funções auxiliares (IVRs)
  const ivrIds = await alpha7Functions(
    instance,
    loginData.token,
    dbName,
    queueId,
    apiKey,
  );

  // 3. Carrega o Template da IA configurada
  // Note que passamos os IDs retornados pela alpha7Functions
  const iaPayload = await loadAndParseTemplate('ia/alpha7_ia_config.json', {
    id: aiData.id,
    signaturename: name,
    context: context || 'Você é um assistente...', // Fallback se context for null
    preautomationId: ivrIds.adicionaItemId,
    automationId: ivrIds.envioItemsId
  });

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
    console.log('IA Alpha7 configurada com sucesso!:', createAlphaAiResponse.data);
    return createAlphaAiResponse.data;
  } catch (error) {
    console.error(
      'Falha ao configurar a IA Alpha7:',
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
    const automationPayload = await loadAndParseTemplate('default_pre_automation.json', {});

    installResponse = await axios.post(
      `${instance}/ivrs/`,
      automationPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
      },
    );
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
    const iaPayload = {
      id: aiData.id,
      name: `${name}`,
      signaturename: name,
      type: 11,
      description: context,
      preautomation: installResponse.data.id,
      postautomation: 0,
      waitfornewmsgs: 4,
      msgslimit: 100,
      functions: [],
      files: [],
    };

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

    return createAiResponse.data;
  } catch (error) {
    console.error(
      'Falha ao criar a IA:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
}