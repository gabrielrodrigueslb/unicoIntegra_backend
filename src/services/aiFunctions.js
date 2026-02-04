import axios from 'axios';
import { loadAndParseTemplate } from './TemplateService.js';

function getDominio(url) {
  const normalized = url.startsWith('http')
    ? url
    : `https://${url}`

  const { hostname } = new URL(normalized)
  return hostname.split('.')[0]
}


export async function alpha7Functions(
  instance,
  token,
  clientIp, clientPort, unidade_negocio, apiKey, queueId, iaId
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
      clientIpCliente: clientIp,
      clientPortCliente: clientPort,
      unidade_negocio: unidade_negocio,
      iaId: iaId
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
    console.log('--- Passo 2: Filtra itens ---');
    const payloadFiltraProduto = await loadAndParseTemplate('alpha7_filtra_produto.json', commonVars);

    const resFiltraProduto = await axios.post(
      `${instance}/ivrs/`,
      payloadFiltraProduto,
      axiosConfig,
    );

    if (!resFiltraProduto.data?.id) throw new Error('Falha ao criar FiltraProduto');
    const FiltraProdutoItemId = resFiltraProduto.data.id;
    console.log(`FiltraProduto criado. ID: ${FiltraProdutoItemId}`);

    // =====================================================================
    // PASSO 3: Instalar "Envio de Itens"
    // Dependências: instanciaDoCliente, queueIdCliente, apiKeyCliente, dbNameCliente + idDownloadImage
    // =====================================================================
    console.log('--- Passo 3: Envio de Itens ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const buscaItensItemsVars = {
      ...commonVars,
      idDownloadImage: idDownloadImage
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadBuscaItens = await loadAndParseTemplate('alpha7_busca_itens.json', buscaItensItemsVars);

    const resBuscaItens = await axios.post(
      `${instance}/ivrs/`,
      payloadBuscaItens,
      axiosConfig,
    );

    if (!resBuscaItens.data?.id) throw new Error('Falha ao criar BuscaItens de Itens');
    const BuscaItensId = resBuscaItens.data.id;
    console.log(`BuscaItens de Itens criado. ID: ${BuscaItensId}`);

    // =====================================================================
    // PASSO 4: Instalar "Ura IA"
    // Dependências: iaId
    // =====================================================================
    console.log('--- Passo 4: URA IA ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const uraIaVars = {
      ...commonVars,
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadUraIa = await loadAndParseTemplate('ura_ia.json', uraIaVars);

    const resUraIa = await axios.post(
      `${instance}/ivrs/`,
      payloadUraIa,
      axiosConfig,
    );

    if (!resUraIa.data?.id) throw new Error('Falha ao criar Ura da IA');
    const UraIaId = resUraIa.data.id;
    console.log(`Ura da foi criada. ID: ${UraIaId}`);


    // =====================================================================
    // PASSO 5: Instalar "Ura - teste AB"
    // Dependências: UraIaId
    // =====================================================================
    console.log('--- Passo 5: URA IA - AB ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const uraIaAbVars = {
      ...commonVars,
      UraIaId: UraIaId
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadUraIaAb = await loadAndParseTemplate('ura_ia_ab.json', uraIaAbVars);

    const resUraIaAb = await axios.post(
      `${instance}/ivrs/`,
      payloadUraIaAb,
      axiosConfig,
    );

    if (!resUraIaAb.data?.id) throw new Error('Falha ao criar Ura da IA - AB');
    const UraIaAbId = resUraIaAb.data.id;
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaAbId}`);


    // =====================================================================
    // PASSO 6: Instalar "Ura - teste AB"
    // Dependências: UraIaId
    // =====================================================================
    console.log('--- Passo 6: Pré processamento ---');


    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadPreProcess = await loadAndParseTemplate('ai_pre_processamento.json', commonVars);

    const resPreProcess = await axios.post(
      `${instance}/ivrs/`,
      payloadPreProcess,
      axiosConfig,
    );

    if (!resPreProcess.data?.id) throw new Error('Falha ao criar Ura da IA - AB');
    const preProcessId = resPreProcess.data.id;
    console.log(`Ura da IA - AB foi criada. ID: ${preProcessId}`);


    // =====================================================================
    // RETORNO FINAL
    // =====================================================================
    return {
      success: true,
      downloadImageId: idDownloadImage,
      FiltraProdutoItemId: FiltraProdutoItemId,
      BuscaItensId: BuscaItensId,
      UraIaId: UraIaId,
      UraIaAbId: UraIaAbId,
      preProcessId: preProcessId
    };

  } catch (error) {
    console.error(
      'Erro crítico em alpha7Functions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function vannonFunctions(
  instance,
  token,
  clientEndpoint, apiKey, queueId, iaId, cepLoja
) {
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
      clientEndpoint: clientEndpoint,
      iaId: iaId,
      cepLoja:cepLoja
    };

    // =====================================================================
    // PASSO 1: Instalar "download de imagens IA Vannon"
    // =====================================================================
    console.log('--- Passo 1: Download Image ---');
    const payloadDownload = await loadAndParseTemplate('ia/vannon/download_de_imagens_IA_Vannon.json');

    const resDownload = await axios.post(
      `${instance}/ivrs/`,
      payloadDownload,
      axiosConfig,
    );

    if (!resDownload.data?.id) throw new Error('Falha ao criar Download Image');
    const idDownloadImage = resDownload.data.id;
    console.log(`Download Image criado. ID: ${idDownloadImage}`);

    // =====================================================================
    // PASSO 2: Instalar "pré processamento"
    // Dependências: instanciaDoCliente, queueIdCliente, apiKeyCliente
    // =====================================================================
    console.log('--- Passo 2: pré processamento ---');
    const payloadpreProcess = await loadAndParseTemplate('ia/vannon/pre_processamento.json');

    const resPreProcess = await axios.post(
      `${instance}/ivrs/`,
      payloadpreProcess,
      axiosConfig,
    );

    if (!resPreProcess.data?.id) throw new Error('Falha ao criar Pré processamento');
    const preProcessId = resPreProcess.data.id;
    console.log(`Pré processamento criado. ID: ${preProcessId}`);

    // =====================================================================
    // PASSO 3: Instalar "Envio de Itens"
    // Dependências: idDownloadImage
    // =====================================================================
    console.log('--- Passo 3: Envio de Itens ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const buscaItensItemsVars = {
      idDownloadImage: idDownloadImage
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadEnvioItens = await loadAndParseTemplate('ia/vannon/envio_itens_vannon.json', buscaItensItemsVars);

    const resEnvioItens = await axios.post(
      `${instance}/ivrs/`,
      payloadEnvioItens,
      axiosConfig,
    );

    if (!resEnvioItens.data?.id) throw new Error('Falha ao criar envioItens de Itens');
    const envioItensId = resEnvioItens.data.id;
    console.log(`envioItens criado. ID: ${envioItensId}`);

    // =====================================================================
    // PASSO 4: Instalar "transfere_para_atendente_encerrar"
    // =====================================================================
    console.log('--- Passo 4: Envio de Itens ---');

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadTransfere = await loadAndParseTemplate('ia/vannon/transfere_para_atendente_encerrar.json')

    const resTransfere = await axios.post(
      `${instance}/ivrs/`,
      payloadTransfere,
      axiosConfig,
    );

    if (!resTransfere.data?.id) throw new Error('Falha ao criar Transfererir para atendente');
    const transfereId = resTransfere.data.id;
    console.log(`Transfererir para atendente criado. ID: ${transfereId}`);

    // =====================================================================
    // PASSO 5: Instalar "Ura IA"
    // Dependências: iaId
    // =====================================================================
    console.log('--- Passo 5: URA IA ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const uraIaAbVars = {
      cepLoja: cepLoja
    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadUraIaAb = await loadAndParseTemplate('ia/vannon/ura_vannon.json', uraIaAbVars);

    const resUraIaAb = await axios.post(
      `${instance}/ivrs/`,
      payloadUraIaAb,
      axiosConfig,
    );

    if (!resUraIaAb.data?.id) throw new Error('Falha ao criar Ura da IA - AB');
    const UraIaId = resUraIaAb.data.id;
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaAbId}`);


    // =====================================================================
    // PASSO 6: Instalar "Ura - teste AB"
    // Dependências: UraIaId
    // =====================================================================
    console.log('--- Passo 6: URA AB ---');

    // Cria o objeto final mesclando as comuns com o ID gerado dinamicamente
    const uraAbVars = {
      ...commonVars,
      UraIaId: UraIaId,
      clientEndpointUnico: getDominio(instance),
      clientEndpoint: clientEndpoint


    };

    // Atenção ao nome do arquivo: mantive conforme seu upload anterior
    const payloadUraAb = await loadAndParseTemplate('ia/vannon/ura_ab.json', uraAbVars);

    const resUraAb = await axios.post(
      `${instance}/ivrs/`,
      payloadUraAb,
      axiosConfig,
    );

    if (!resUraAb.data?.id) throw new Error('Falha ao criar Ura da IA - AB');
    const UraAbId = resUraAb.data.id;
    console.log(`Ura da IA - AB foi criada. ID: ${UraAbId}`);

    // =====================================================================
    // RETORNO FINAL
    // =====================================================================
    return {
      success: true,
      downloadImageId: idDownloadImage,
      preProcessId: preProcessId,
      FiltraProdutoItemId:FiltraProdutoItemId,
      envioItensId: envioItensId,
      transfereId: transfereId,
      UraIaId: UraIaId,
      UraAbId: UraAbId
    };

  } catch (error) {
    console.error(
      'Erro crítico em alpha7Functions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}