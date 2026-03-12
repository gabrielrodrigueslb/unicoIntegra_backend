import { loadAndParseTemplate } from './TemplateService.js';
import { postIvr } from './instanceApi.services.js';

function getDominio(url) {
  const normalized = url.startsWith('http') ? url : `https://${url}`;

  const { hostname } = new URL(normalized);
  return hostname.split('.')[0];
}

async function installTemplate({
  instance,
  token,
  templatePath,
  variables = {},
  errorMessage,
}) {
  const payload = await loadAndParseTemplate(templatePath, variables);
  const response = await postIvr(instance, payload, token);

  if (!response?.id) {
    throw new Error(errorMessage);
  }

  return response.id;
}

export async function alpha7Functions(
  instance,
  token,
  clientIp,
  clientPort,
  unidade_negocio,
  apiKey,
  queueId,
  iaId,
) {
  try {
    const commonVars = {
      instanciaDoCliente: instance,
      queueIdCliente: queueId,
      apiKeyCliente: apiKey,
      clientIpCliente: clientIp,
      clientPortCliente: clientPort,
      unidade_negocio,
      iaId,
    };

    console.log('--- Passo 1: Download Image ---');
    const idDownloadImage = await installTemplate({
      instance,
      token,
      templatePath: 'alpha7Download.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${idDownloadImage}`);

    console.log('--- Passo 2: Filtra itens ---');
    const FiltraProdutoItemId = await installTemplate({
      instance,
      token,
      templatePath: 'alpha7_filtra_produto.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar FiltraProduto',
    });
    console.log(`FiltraProduto criado. ID: ${FiltraProdutoItemId}`);

    console.log('--- Passo 3: Envio de Itens ---');
    const BuscaItensId = await installTemplate({
      instance,
      token,
      templatePath: 'alpha7_busca_itens.json',
      variables: {
        ...commonVars,
        idDownloadImage,
      },
      errorMessage: 'Falha ao criar BuscaItens de Itens',
    });
    console.log(`BuscaItens de Itens criado. ID: ${BuscaItensId}`);

    console.log('--- Passo 4: URA IA ---');
    const UraIaId = await installTemplate({
      instance,
      token,
      templatePath: 'ura_ia.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Ura da IA',
    });
    console.log(`Ura da foi criada. ID: ${UraIaId}`);

    console.log('--- Passo 5: URA IA - AB ---');
    const UraIaAbId = await installTemplate({
      instance,
      token,
      templatePath: 'ura_ia_ab.json',
      variables: {
        ...commonVars,
        UraIaId,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaAbId}`);

    console.log('--- Passo 6: Pré processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ai_pre_processamento.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar pré processamento',
    });
    console.log(`Pré processamento criado. ID: ${preProcessId}`);

    return {
      success: true,
      downloadImageId: idDownloadImage,
      FiltraProdutoItemId,
      BuscaItensId,
      UraIaId,
      UraIaAbId,
      preProcessId,
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
  clientEndpoint,
  clientName,
  apiKey,
  queueId,
  iaId,
  cepLoja,
) {
  try {
    const vannonInstallVars = {
      clientEndpoint,
      clientName,
      clientEndpointUnico: getDominio(instance),
      clientQueueId: queueId,
      iaId,
      clientApiKey: apiKey,
    };

    console.log('--- Passo 1: Download Image ---');
    const idDownloadImage = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/download_de_imagens_IA_Vannon.json',
      variables: vannonInstallVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${idDownloadImage}`);

    console.log('--- Passo 2: pré processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/pre_processamento.json',
      variables: vannonInstallVars,
      errorMessage: 'Falha ao criar Pré processamento',
    });
    console.log(`Pré processamento criado. ID: ${preProcessId}`);

    console.log('--- Passo 3: Envio de Itens ---');
    const envioItensId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/envio_itens_vannon.json',
      variables: {
        ...vannonInstallVars,
        idDownloadImage,
      },
      errorMessage: 'Falha ao criar envioItens de Itens',
    });
    console.log(`envioItens criado. ID: ${envioItensId}`);

    console.log('--- Passo 4: Envio de Itens ---');
    const transfereId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/transfere_para_atendente_encerrar.json',
      errorMessage: 'Falha ao criar Transfererir para atendente',
    });
    console.log(`Transfererir para atendente criado. ID: ${transfereId}`);

    console.log('--- Passo 5: URA IA ---');
    const UraIaId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/ura_vannon.json',
      variables: {
        ...vannonInstallVars,
        iaId,
        cepLoja,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaId}`);

    console.log('--- Passo 6: URA AB ---');
    const UraAbId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/ura_ab.json',
      variables: {
        ...vannonInstallVars,
        UraIaId,
        idDownloadImage,
        clientName,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB foi criada. ID: ${UraAbId}`);

    return {
      success: true,
      downloadImageId: idDownloadImage,
      preProcessId,
      envioItensId,
      transfereId,
      UraIaId,
      UraAbId,
    };
  } catch (error) {
    console.error(
      'Erro crítico em alpha7Functions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
