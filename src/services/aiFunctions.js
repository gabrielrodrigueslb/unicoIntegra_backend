import axios from 'axios';
import { loadAndParseTemplate } from './TemplateService.js';

export async function alpha7Functions(
  instance,
  token,
  dbName,
  queueId,
  apiKey,
) {
  // Configuração do Header de Autorização (para a requisição de POST atual)
  const axiosConfig = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    // 1. DEFINIÇÃO DE VARIÁVEIS DE INSTALAÇÃO
    const commonVars = {
      instanciaDoCliente: instance,
      queueIdCliente: queueId,
      apiKeyCliente: apiKey,
      dbNameCliente: dbName,
    };

    // =====================================================================
    // PASSO 1: Instalar "Download Image"
    // Dependências: instanciaDoCliente, queueIdCliente, apiKeyCliente
    // =====================================================================
    console.log('--- Passo 1: Download Image ---');
    const payloadDownload = await loadAndParseTemplate('alpha7Download.json', commonVars);

    const resDownload = await axios.post(
      `${instance}/ivrs/`,
      payloadDownload,
      axiosConfig,
    );

    if (!resDownload.data?.id) throw new Error('Falha ao criar Download Image');
    const idDownloadImage = resDownload.data.id;
    console.log(`Download Image criado. ID: ${idDownloadImage}`);

    // =====================================================================
    // PASSO 2: Instalar "Adiciona Item"
    // Dependências: instanciaDoCliente, queueIdCliente, apiKeyCliente
    // =====================================================================
    console.log('--- Passo 2: Adiciona Item ---');
    const payloadAdiciona = await loadAndParseTemplate('alpha7_adiciona_item.json', commonVars);

    const resAdiciona = await axios.post(
      `${instance}/ivrs/`,
      payloadAdiciona,
      axiosConfig,
    );

    if (!resAdiciona.data?.id) throw new Error('Falha ao criar Adiciona Item');
    const adicionaItemId = resAdiciona.data.id;
    console.log(`Adiciona Item criado. ID: ${adicionaItemId}`);

    // =====================================================================
    // PASSO 3: Instalar "Envio de Itens"
    // Dependências: instanciaDoCliente, queueIdCliente, apiKeyCliente, dbNameCliente + idDownloadImage
    // =====================================================================
    console.log('--- Passo 3: Envio de Itens ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const envioItemsVars = {
      ...commonVars,
      idDownloadImage: idDownloadImage
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadEnvio = await loadAndParseTemplate('alpha7_envio_items.json.json', envioItemsVars);

    const resEnvio = await axios.post(
      `${instance}/ivrs/`,
      payloadEnvio,
      axiosConfig,
    );

    if (!resEnvio.data?.id) throw new Error('Falha ao criar Envio de Itens');
    const envioItemsId = resEnvio.data.id;
    console.log(`Envio de Itens criado. ID: ${envioItemsId}`);

    // =====================================================================
    // RETORNO FINAL
    // =====================================================================
    return {
      success: true,
      downloadImageId: idDownloadImage,
      adicionaItemId: adicionaItemId,
      envioItemsId: envioItemsId,
    };

  } catch (error) {
    console.error(
      'Erro crítico em alpha7Functions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}