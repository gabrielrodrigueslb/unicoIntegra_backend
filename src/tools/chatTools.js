import {
  listAutomatableIntegrations,
  listAvailableIas,
} from '../catalogs/linkAiCatalog.js';

const integrationKeys = listAutomatableIntegrations().map((item) => item.key);
const integrationDescription = listAutomatableIntegrations()
  .map((item) => {
    const fieldLabels = item.fields.length
      ? item.fields.map((field) => field.label).join(', ')
      : 'nenhum campo adicional';

    return `${item.key}: ${item.name} (campos: ${fieldLabels})`;
  })
  .join('; ');

const aiKeys = listAvailableIas().map((item) => item.key);
const aiDescription = listAvailableIas()
  .map((item) => {
    const fieldLabels = item.fields.length
      ? item.fields.map((field) => field.label).join(', ')
      : 'nenhum campo adicional';

    return `${item.key}: ${item.name} (campos: ${fieldLabels})`;
  })
  .join('; ');

export const chatTools = [
  {
    type: 'function',
    name: 'gerar_build_projeto',
    description:
      'Gera build apos configurar variaveis de ambiente do projeto do cliente.',
    parameters: {
      type: 'object',
      properties: {
        nome_cliente: {
          type: 'string',
          description: 'Nome do cliente que recebera o build.',
        },
        api_url: {
          type: 'string',
          description: 'URL base da API do cliente.',
        },
      },
      required: ['nome_cliente', 'api_url'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'configurar_extensao_trier',
    description:
      'Prepara a configuracao da extensao Trier a partir do arquivo .env. Use esta tool quando o usuario pedir para configurar, montar ou criar a extensao Trier. Nao use esta tool para criar a IA Trier. A extensao Trier precisa apenas da URL da instancia do cliente e do token da Trier. A URL deve sempre terminar com /.',
    parameters: {
      type: 'object',
      properties: {
        instance_url: {
          type: 'string',
          description:
            'URL base da instancia do cliente. Deve ser normalizada para terminar com /.',
        },
        client_token: {
          type: 'string',
          description: 'Token de integracao da Trier.',
        },
      },
      required: ['instance_url', 'client_token'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'instalar_integracao_catalogo',
    description: `Instala integrações, automações e URAs do catálogo atual. Usa o username e password já autenticados na sessão do operador; o usuário precisa informar a URL da instância, o código 2FA e os campos específicos da integração. Catálogo: ${integrationDescription}`,
    parameters: {
      type: 'object',
      properties: {
        template_key: {
          type: 'string',
          enum: integrationKeys,
          description: 'Chave da integração a instalar.',
        },
        instance: {
          type: 'string',
          description: 'URL base da instância do cliente.',
        },
        code: {
          type: 'string',
          description: 'Código 2FA da instância.',
        },
        ip_do_cliente: { type: 'string' },
        authorization: { type: 'string' },
        nome_da_empresa: { type: 'string' },
        client_ip: { type: 'string' },
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
        cnpj_cliente: { type: 'string' },
        nome_loja: { type: 'string' },
        cliente: { type: 'string' },
        autenticacao: { type: 'string' },
        client_api_key: { type: 'string' },
        client_url: { type: 'string' },
        credencial: { type: 'string' },
        queue_id: { type: 'string' },
        apikey: { type: 'string' },
        url: { type: 'string' },
      },
      required: ['template_key', 'instance', 'code'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'criar_ia_catalogo',
    description: `Cria IAs do catálogo atual. Usa o username e password já autenticados na sessão do operador; o usuário precisa informar a URL da instância, o código 2FA, o nome da IA e os campos específicos do template. Catálogo: ${aiDescription}`,
    parameters: {
      type: 'object',
      properties: {
        template_key: {
          type: 'string',
          enum: aiKeys,
          description: 'Chave da IA a criar.',
        },
        instance: {
          type: 'string',
          description: 'URL base da instância do cliente.',
        },
        code: {
          type: 'string',
          description: 'Código 2FA da instância.',
        },
        name: {
          type: 'string',
          description: 'Nome da IA.',
        },
        context: {
          type: 'string',
          description: 'Contexto da IA de atendimento quando necessário.',
        },
        nome_cliente: { type: 'string' },
        apiKey: { type: 'string' },
        porta_cliente: { type: 'string' },
        unidade_negocio: { type: 'string' },
        nomeCliente: { type: 'string' },
        clientName: { type: 'string' },
        clientEndpoint: { type: 'string' },
        cepLoja: { type: 'string' },
        vetorToken: { type: 'string' },
        unidade_negocio_vetor: { type: 'string' },
      },
      required: ['template_key', 'instance', 'code', 'name'],
      additionalProperties: false,
    },
  },
];
