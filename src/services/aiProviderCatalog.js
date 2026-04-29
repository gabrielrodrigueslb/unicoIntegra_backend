export const MANAGED_AI_COMPONENT_KEYS = [
  'assistant',
  'downloadImagem',
  'buscaProdutos',
  'ura',
  'uraAb',
  'preProcess',
];

export const MANAGED_AI_MANUAL_UPDATE_COMPONENT_KEYS = ['ura', 'uraAb'];

const MANAGED_AI_PROVIDER_DEFINITIONS = {
  alpha7: {
    provider: 'alpha7',
    displayName: 'IA - Alpha 7',
    templateName: 'IA - Alpha 7 Integrada',
    fallbackVersion: 1,
    templatePaths: {
      assistant: 'ia/alpha7/alpha_ia_config.json',
      downloadImagem: 'ia/alpha7/alpha_download_imagem.json',
      buscaProdutos: 'ia/alpha7/alpha_busca_produtos.json',
      ura: 'ia/alpha7/alpha_ura.json',
      uraAb: 'ia/alpha7/alpha_ab.json',
      preProcess: 'ia/alpha7/alpha_pre_processamento.json',
    },
    installOrder: ['downloadImagem', 'buscaProdutos', 'ura', 'uraAb', 'preProcess'],
    updateOrder: ['downloadImagem', 'buscaProdutos', 'preProcess'],
    createConfigSnapshot(input = {}) {
      const quantidadeDeProdutos = Number(
        input.quantidade_de_produtos ?? input.quantidadeDeProdutos ?? 3,
      );

      return {
        assistantDisplayName: input.name ?? '',
        nome_cliente: input.nome_cliente ?? input.nomeCliente ?? input.clientName ?? '',
        apiKey: input.apiKey ?? '',
        porta_cliente: input.porta_cliente ?? input.clientPort ?? '',
        unidade_negocio: input.unidade_negocio ?? input.unidadeNegocio ?? '',
        quantidade_de_produtos:
          Number.isFinite(quantidadeDeProdutos) && quantidadeDeProdutos > 0
            ? Math.min(7, quantidadeDeProdutos)
            : 3,
      };
    },
    buildTemplateVariables({ instance, assistantId, config = {}, ids = {} }) {
      const quantidadeDeProdutos = Number(config.quantidade_de_produtos);

      return {
        id: assistantId,
        ia_id: assistantId,
        signaturename: config.assistantDisplayName || 'LeIA',
        nome_cliente: config.nome_cliente || '',
        nome_cliente_var: config.nome_cliente || '',
        api_key: config.apiKey || '',
        url_cliente: instance,
        porta_cliente: config.porta_cliente || '',
        unidade_negocio: config.unidade_negocio || '',
        quantidade_de_produtos:
          Number.isFinite(quantidadeDeProdutos) && quantidadeDeProdutos > 0
            ? Math.min(7, quantidadeDeProdutos)
            : 3,
        preProcessId: ids.preProcessId || '',
        BuscaItensId: ids.buscaProdutosId || '',
        download_img_id: ids.downloadImagemId || '',
        ura_ia_id: ids.uraIaId || '',
      };
    },
    canUpdateInstallation(record = {}) {
      return Boolean(
        record.assistantId &&
          record.preProcessId &&
          record.buscaProdutosId &&
          record.downloadImagemId &&
          record.uraIaId &&
          record.uraAbId &&
          record.configSnapshot?.nome_cliente &&
          record.configSnapshot?.apiKey &&
          record.configSnapshot?.porta_cliente &&
          record.configSnapshot?.unidade_negocio,
      );
    },
  },
  trier: {
    provider: 'trier',
    displayName: 'IA - Trier',
    templateName: 'IA - Trier Integrada',
    fallbackVersion: 1,
    templatePaths: {
      assistant: 'ia/trier/trier_ia_config.json',
      downloadImagem: 'ia/trier/trier_download_imagem.json',
      buscaProdutos: 'ia/trier/trier_busca_produtos.json',
      ura: 'ia/trier/trier_ura.json',
      uraAb: 'ia/trier/trier_ab.json',
      preProcess: 'ia/trier/trier_pre_processamento.json',
    },
    installOrder: ['downloadImagem', 'buscaProdutos', 'ura', 'uraAb', 'preProcess'],
    updateOrder: ['downloadImagem', 'buscaProdutos', 'preProcess'],
    createConfigSnapshot(input = {}) {
      return {
        assistantDisplayName: input.name ?? '',
        nome_cliente: input.nome_cliente ?? input.nomeCliente ?? input.clientName ?? '',
        apiKey: input.apiKey ?? '',
        porta_cliente: input.porta_cliente ?? input.clientPort ?? '',
      };
    },
    buildTemplateVariables({ instance, assistantId, config = {}, ids = {} }) {
      return {
        id: assistantId,
        ia_id: assistantId,
        signaturename: config.assistantDisplayName || 'LeIA',
        nome_cliente: config.nome_cliente || '',
        nome_cliente_var: config.nome_cliente || '',
        api_key: config.apiKey || '',
        url_cliente: instance,
        porta_cliente: config.porta_cliente || '',
        preProcessId: ids.preProcessId || '',
        BuscaItensId: ids.buscaProdutosId || '',
        download_img_id: ids.downloadImagemId || '',
        ura_ia_id: ids.uraIaId || '',
      };
    },
    canUpdateInstallation(record = {}) {
      return Boolean(
        record.assistantId &&
          record.preProcessId &&
          record.buscaProdutosId &&
          record.downloadImagemId &&
          record.uraIaId &&
          record.uraAbId &&
          record.configSnapshot?.nome_cliente &&
          record.configSnapshot?.apiKey &&
          record.configSnapshot?.porta_cliente,
      );
    },
  },
  vannon: {
    provider: 'vannon',
    displayName: 'IA - Vannon',
    templateName: 'IA - Vannon Integrada',
    fallbackVersion: 1,
    templatePaths: {
      assistant: 'ia/vannon/Vannon_ai_config.json',
      downloadImagem: 'ia/vannon/download_de_imagens_IA_Vannon.json',
      buscaProdutos: 'ia/vannon/busca_produtos.json',
      ura: 'ia/vannon/ura_vannon.json',
      uraAb: 'ia/vannon/vannon_ab.json',
      preProcess: 'ia/vannon/pre_processamento.json',
    },
    installOrder: ['downloadImagem', 'buscaProdutos', 'preProcess', 'ura', 'uraAb'],
    updateOrder: ['downloadImagem', 'buscaProdutos', 'preProcess'],
    createConfigSnapshot(input = {}) {
      return {
        assistantDisplayName: input.name ?? '',
        clientName: input.clientName ?? '',
        clientEndpoint: input.clientEndpoint ?? '',
        apiKey: input.apiKey ?? '',
        cepLoja: input.cepLoja ?? '',
      };
    },
    buildTemplateVariables({ instance, assistantId, config = {}, ids = {} }) {
      return {
        id: assistantId,
        ia_id: assistantId,
        signaturename: config.assistantDisplayName || 'LeIA',
        nome_cliente: config.clientName || '',
        cliente_var: config.clientName || '',
        endpoint_var: normalizeBaseUrl(instance),
        api_var: config.apiKey || '',
        client_endpoint_var: getDominio(config.clientEndpoint || ''),
        cep_var: config.cepLoja || '',
        preProcessId: ids.preProcessId || '',
        busca_produtos_id: ids.buscaProdutosId || '',
        download_image_id: ids.downloadImagemId || '',
        ura_ia_id: ids.uraIaId || '',
      };
    },
    canUpdateInstallation(record = {}) {
      return Boolean(
        record.assistantId &&
          record.preProcessId &&
          record.buscaProdutosId &&
          record.downloadImagemId &&
          record.uraIaId &&
          record.uraAbId &&
          record.configSnapshot?.clientName &&
          record.configSnapshot?.clientEndpoint &&
          record.configSnapshot?.apiKey &&
          record.configSnapshot?.cepLoja,
      );
    },
  },
  vetor: {
    provider: 'vetor',
    displayName: 'IA - Vetor',
    templateName: 'IA - Vetor Integrada',
    fallbackVersion: 1,
    templatePaths: {
      assistant: 'ia/vetor/vetor_ai_config.json',
      downloadImagem: 'ia/vetor/download_de_imagens_IA_Vannon.json',
      buscaProdutos: 'ia/vetor/busca_produtos.json',
      ura: 'ia/vetor/ura_vetor.json',
      uraAb: 'ia/vetor/vannon_ab.json',
      preProcess: 'ia/vetor/pre_processamento.json',
    },
    installOrder: ['downloadImagem', 'buscaProdutos', 'preProcess', 'ura', 'uraAb'],
    updateOrder: ['downloadImagem', 'buscaProdutos', 'preProcess'],
    createConfigSnapshot(input = {}) {
      return {
        assistantDisplayName: input.name ?? '',
        clientName: input.clientName ?? '',
        apiKey: input.apiKey ?? '',
        vetorToken: input.vetorToken ?? '',
        unidade_negocio_vetor:
          input.unidade_negocio_vetor ?? input.unidadeNegocioVetor ?? '',
      };
    },
    buildTemplateVariables({ instance, assistantId, config = {}, ids = {} }) {
      return {
        id: assistantId,
        ia_id: assistantId,
        signaturename: config.assistantDisplayName || 'LeIA',
        nome_cliente: config.clientName || '',
        cliente_var: config.clientName || '',
        endpoint_var: normalizeBaseUrl(instance),
        api_var: config.apiKey || '',
        var_vetorKey: config.vetorToken || '',
        unidade_negocio_vetor: config.unidade_negocio_vetor || '',
        preProcessId: ids.preProcessId || '',
        busca_produtos_id: ids.buscaProdutosId || '',
        download_image_id: ids.downloadImagemId || '',
        ura_ia_id: ids.uraIaId || '',
      };
    },
    canUpdateInstallation(record = {}) {
      return Boolean(
        record.assistantId &&
          record.preProcessId &&
          record.buscaProdutosId &&
          record.downloadImagemId &&
          record.uraIaId &&
          record.uraAbId &&
          record.configSnapshot?.clientName &&
          record.configSnapshot?.apiKey &&
          record.configSnapshot?.vetorToken &&
          record.configSnapshot?.unidade_negocio_vetor,
      );
    },
  },
};

export const MANAGED_AI_PROVIDERS = Object.keys(MANAGED_AI_PROVIDER_DEFINITIONS);
export const NON_UPDATABLE_AI_PROVIDERS = ['atendimento'];

export function getManagedAiProviderDefinition(provider) {
  return MANAGED_AI_PROVIDER_DEFINITIONS[provider] || null;
}

export function isManagedAiProvider(provider) {
  return Boolean(getManagedAiProviderDefinition(provider));
}

export function createManagedAiConfigSnapshot(provider, input) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  return definition.createConfigSnapshot(input);
}

export function buildManagedAiTemplateVariables(provider, payload) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  return definition.buildTemplateVariables(payload);
}

export function getManagedAiInstallOrder(provider) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  return [...definition.installOrder];
}

export function getManagedAiUpdateOrder(provider) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  return [...(definition.updateOrder || definition.installOrder)];
}

export function isManagedAiComponentKey(componentKey) {
  return MANAGED_AI_COMPONENT_KEYS.includes(String(componentKey || '').trim());
}

export function isManagedAiManualUpdateOnlyComponentKey(componentKey) {
  return MANAGED_AI_MANUAL_UPDATE_COMPONENT_KEYS.includes(
    String(componentKey || '').trim(),
  );
}

export function getManagedAiTemplatePaths(provider) {
  const definition = getManagedAiProviderDefinition(provider);
  if (!definition) {
    throw new Error(`Provider de IA nao suportado: ${provider}`);
  }

  return { ...definition.templatePaths };
}

export function canManagedAiInstallationBeUpdated(record) {
  if (isAiProviderUpdateBlocked(record?.provider)) {
    return false;
  }

  const definition = getManagedAiProviderDefinition(record?.provider);
  if (!definition) {
    return false;
  }

  return definition.canUpdateInstallation(record);
}

export function isAiProviderUpdateBlocked(provider) {
  return NON_UPDATABLE_AI_PROVIDERS.includes(String(provider || '').trim().toLowerCase());
}

export function inferManagedAiProviderFromPayload(payload = {}) {
  const name = String(payload?.name || '').toLowerCase();
  const description = String(payload?.description || '').toLowerCase();

  if (name.includes('alpha7') || name.includes('alpha 7')) {
    return 'alpha7';
  }

  if (name.includes('trier')) {
    return 'trier';
  }

  if (name.includes('vannon')) {
    return 'vannon';
  }

  if (name.includes('vetor')) {
    return 'vetor';
  }

  if (description.includes('vetor')) {
    return 'vetor';
  }

  if (description.includes('vannon')) {
    return 'vannon';
  }

  return null;
}

export function getManagedAiProviderFallbackVersion(provider) {
  const definition = getManagedAiProviderDefinition(provider);
  return Number(definition?.fallbackVersion || 1);
}

function getDominio(url) {
  if (!url) return '';

  const normalized = url.startsWith('http') ? url : `https://${url}`;
  const { hostname } = new URL(normalized);
  return hostname.split('.')[0];
}

function normalizeBaseUrl(url) {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  return normalized.replace(/\/+$/, '');
}
