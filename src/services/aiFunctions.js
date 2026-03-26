import { loadAndParseTemplate } from './TemplateService.js';
import { postIvr } from './instanceApi.services.js';

function getDominio(url) {
  const normalized = url.startsWith('http') ? url : `https://${url}`;

  const { hostname } = new URL(normalized);
  return hostname.split('.')[0];
}

function normalizeBaseUrl(url) {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  return normalized.replace(/\/+$/, '');
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

export async function alpha7Functions({
  instance,
  token,
  nome_cliente,
  porta_cliente,
  unidade_negocio,
  apiKey,
  iaId,
}) {
  try {
    const commonVars = {
      url_cliente: instance,
      api_key: apiKey,
      nome_cliente,
      porta_cliente,
      unidade_negocio,
      ia_id: iaId,
    };

    console.log('--- Passo 1: Download Image ---');
    const download_img_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/alpha7/alpha_download_imagem.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${download_img_id}`);

    console.log('--- Passo 2: busca de produtos ---');
    const BuscaItensId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/alpha7/alpha_busca_produtos.json',
      variables: {
        ...commonVars,
        download_img_id,
      },
      errorMessage: 'Falha ao criar BuscaItens de Itens',
    });
    console.log(`BuscaItens de Itens criado. ID: ${BuscaItensId}`);

    console.log('--- Passo 3: URA IA ---');
    const ura_ia_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/alpha7/alpha_ura.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Ura da IA',
    });
    console.log(`Ura da foi criada. ID: ${ura_ia_id}`);

    console.log('--- Passo 4: URA IA - AB ---');
    const UraIaAbId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/alpha7/alpha_ab.json',
      variables: {
        ...commonVars,
        ura_ia_id,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaAbId}`);

    console.log('--- Passo 5: Pre processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/alpha7/alpha_pre_processamento.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar pre processamento',
    });
    console.log(`Pre processamento criado. ID: ${preProcessId}`);

    return {
      success: true,
      downloadImageId: download_img_id,
      BuscaItensId,
      uraIaId: ura_ia_id,
      uraIaAbId: UraIaAbId,
      preProcessId,
    };
  } catch (error) {
    console.error(
      'Erro critico em alpha7Functions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function trierFunctions({
  instance,
  token,
  nome_cliente,
  porta_cliente,
  apiKey,
  iaId,
}) {
  try {
    const commonVars = {
      url_cliente: instance,
      api_key: apiKey,
      nome_cliente,
      porta_cliente,
      ia_id: iaId,
    };

    console.log('--- Passo 1: Download Image ---');
    const download_img_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/trier/trier_download_imagem.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${download_img_id}`);

    console.log('--- Passo 2: busca de produtos ---');
    const BuscaItensId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/trier/trier_busca_produtos.json',
      variables: {
        ...commonVars,
        download_img_id,
      },
      errorMessage: 'Falha ao criar BuscaItens de Itens',
    });
    console.log(`BuscaItens de Itens criado. ID: ${BuscaItensId}`);

    console.log('--- Passo 3: URA IA ---');
    const ura_ia_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/trier/trier_ura.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar Ura da IA',
    });
    console.log(`Ura da foi criada. ID: ${ura_ia_id}`);

    console.log('--- Passo 4: URA IA - AB ---');
    const UraIaAbId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/trier/trier_ab.json',
      variables: {
        ...commonVars,
        ura_ia_id,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB foi criada. ID: ${UraIaAbId}`);

    console.log('--- Passo 5: Pre processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/trier/trier_pre_processamento.json',
      variables: commonVars,
      errorMessage: 'Falha ao criar pre processamento',
    });
    console.log(`Pre processamento criado. ID: ${preProcessId}`);

    return {
      success: true,
      downloadImageId: download_img_id,
      BuscaItensId,
      uraIaId: ura_ia_id,
      uraIaAbId: UraIaAbId,
      preProcessId,
    };
  } catch (error) {
    console.error(
      'Erro critico em trierFunctions:',
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
  iaId,
  cepLoja,
) {
  try {
    const endpoint_var = normalizeBaseUrl(instance);
    const client_endpoint_var = getDominio(clientEndpoint);

    const vannonInstallVars = {
      endpoint_var,
      api_var: apiKey,
      cliente_var: clientName,
      client_endpoint_var,
      cep_var: cepLoja,
      ia_id: iaId,
    };

    console.log('--- Passo 1: Download Image ---');
    const download_image_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/download_de_imagens_IA_Vannon.json',
      variables: vannonInstallVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${download_image_id}`);

    console.log('--- Passo 2: Busca de produtos ---');
    const busca_produtos_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/busca_produtos.json',
      variables: {
        ...vannonInstallVars,
        download_image_id,
      },
      errorMessage: 'Falha ao criar Busca de produtos',
    });
    console.log(`Busca de produtos criada. ID: ${busca_produtos_id}`);

    console.log('--- Passo 3: Pre processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/pre_processamento.json',
      variables: vannonInstallVars,
      errorMessage: 'Falha ao criar Pre processamento',
    });
    console.log(`Pre processamento criado. ID: ${preProcessId}`);

    console.log('--- Passo 4: URA IA ---');
    const ura_ia_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/ura_vannon.json',
      variables: vannonInstallVars,
      errorMessage: 'Falha ao criar Ura da IA',
    });
    console.log(`Ura da IA criada. ID: ${ura_ia_id}`);

    console.log('--- Passo 5: URA AB ---');
    const ura_ab_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vannon/vannon_ab.json',
      variables: {
        ...vannonInstallVars,
        ura_ia_id,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB criada. ID: ${ura_ab_id}`);

    return {
      success: true,
      downloadImageId: download_image_id,
      download_image_id,
      preProcessId,
      busca_produtos_id,
      ura_ia_id,
      ura_ab_id,
    };
  } catch (error) {
    console.error(
      'Erro critico em vannonFunctions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function vectorFunctions(
  instance,
  token,
  vetorToken,
  clientName,
  apiKey,
  iaId,
) {
  try {
    const endpoint_var = normalizeBaseUrl(instance);

    const vetorInstallVars = {
      endpoint_var,
      api_var: apiKey,
      var_vetorKey: vetorToken,
      cliente_var: clientName,
      ia_id: iaId,
    };

    console.log('--- Passo 1: Download Image ---');
    const download_image_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vetor/download_de_imagens_IA_Vannon.json',
      variables: vetorInstallVars,
      errorMessage: 'Falha ao criar Download Image',
    });
    console.log(`Download Image criado. ID: ${download_image_id}`);

    console.log('--- Passo 2: Busca de produtos ---');
    const busca_produtos_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vetor/busca_produtos.json',
      variables: {
        ...vetorInstallVars,
        download_image_id,
      },
      errorMessage: 'Falha ao criar Busca de produtos',
    });
    console.log(`Busca de produtos criada. ID: ${busca_produtos_id}`);

    console.log('--- Passo 3: Pre processamento ---');
    const preProcessId = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vetor/pre_processamento.json',
      variables: vetorInstallVars,
      errorMessage: 'Falha ao criar Pre processamento',
    });
    console.log(`Pre processamento criado. ID: ${preProcessId}`);

    console.log('--- Passo 4: URA IA ---');
    const ura_ia_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vetor/ura_vetor.json',
      variables: vetorInstallVars,
      errorMessage: 'Falha ao criar Ura da IA',
    });
    console.log(`Ura da IA criada. ID: ${ura_ia_id}`);

    console.log('--- Passo 5: URA AB ---');
    const ura_ab_id = await installTemplate({
      instance,
      token,
      templatePath: 'ia/vetor/vannon_ab.json',
      variables: {
        ...vetorInstallVars,
        ura_ia_id,
      },
      errorMessage: 'Falha ao criar Ura da IA - AB',
    });
    console.log(`Ura da IA - AB criada. ID: ${ura_ab_id}`);

    return {
      success: true,
      downloadImageId: download_image_id,
      download_image_id,
      preProcessId,
      busca_produtos_id,
      ura_ia_id,
      ura_ab_id,
    };
  } catch (error) {
    console.error(
      'Erro critico em vectorFunctions:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
