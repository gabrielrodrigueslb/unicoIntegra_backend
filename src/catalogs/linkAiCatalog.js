const DEFAULT_ATENDIMENTO_CONTEXT = `Você é o assistente HUMANO da [NOME DA DROGARIA];

Nome Fantasia: [NOME FANTASIA];
CNPJ: [CNPJ]
Telefone de contato: [TELEFONE DE CONTATO];
Endereço: Praça Juquinha Moreira, 65 - Centro - Porto Firme - MG;

Horários de funcionamento:
- [HOARIOS DE FUNCIONAMENTO];

IMPORTANTE: Nunca, em hipótese alguma, dê a entender que você é uma IA. Quando for transferir, apenas transfira para o marcador de saída atendente, sem explicações.

OBJETIVO PRINCIPAL:
Realizar o atendimento inicial com cordialidade e eficiência, coletando todas as informações necessárias para transferir para um atendente.

INFORMAÇÕES OBRIGATÓRIAS A COLETAR (uma por vez):
- Produtos desejados (nome e quantidade)
- Verificar se precisa de mais algum produto
- Nome do cliente
- Endereço de entrega (rua, número, bairro e complemento, se houver)
- Método de entrega (Entrega em domicílio ou Retirada na loja)
- Método de pagamento (Dinheiro, Cartão de débito, Cartão de crédito, PIX ou Outros)

INFORMAÇÕES IMPORTANTES:
- Transferir para atendente em todo caso de solicitação de preço ou disponibilidade
- Não informar obrigatoriedade de receita; caso perguntado, apenas transferir
- Quando um medicamento for informado sem o miligrama, solicitar essa informação ao cliente`;

export const integrationCatalog = {
  alpha7extensao: {
    key: 'alpha7extensao',
    name: 'Alpha7 - Extensão',
    type: 'Extensão',
    file: 'Alpha7_orcamento.txt',
    description:
      'Fluxo manual para extensão Alpha7. Não é instalado automaticamente pelo chat.',
    automationSupported: false,
    fields: [
      { inputKey: 'Banco', templateKey: 'Banco', label: 'Banco de dados do cliente' },
      { inputKey: 'Licensa', templateKey: 'Licensa', label: 'Licença de ativação' },
    ],
  },
  alpha7: {
    key: 'alpha7',
    name: 'Alpha7 - Orçamento',
    type: 'Integração',
    file: 'Alpha7_orcamento.txt',
    description: 'Busca de orçamentos criados no ERP Alpha7.',
    automationSupported: true,
    fields: [
      { inputKey: 'ip_do_cliente', templateKey: 'ip_do_cliente', label: 'IP do cliente' },
      { inputKey: 'authorization', templateKey: 'Authorization', label: 'Authorization' },
      { inputKey: 'nome_da_empresa', templateKey: 'nome_da_empresa', label: 'Nome da empresa' },
    ],
  },
  cashback: {
    key: 'cashback',
    name: 'Alpha7 - Cashback ativo',
    type: 'Integração',
    file: 'alpha7_cashback_ativo.txt',
    description: 'Consulta automática de cashback no Alpha7.',
    automationSupported: true,
    fields: [
      { inputKey: 'client_ip', templateKey: 'client_ip', label: 'IP do cliente' },
    ],
  },
  ifood_notificacao: {
    key: 'ifood_notificacao',
    name: 'Ifood - Notificação de pedidos',
    type: 'Integração',
    file: 'ifood.txt',
    description: 'Recebe notificações automáticas de pedidos do iFood.',
    automationSupported: true,
    fields: [
      { inputKey: 'client_id', templateKey: 'ClientId', label: 'ClientId' },
      { inputKey: 'client_secret', templateKey: 'ClientSecret', label: 'ClientSecret' },
    ],
  },
  Napp: {
    key: 'Napp',
    name: 'Integração NAPP carrinho de compras',
    type: 'URA',
    file: 'integracao_napp.txt',
    description: 'URA com carrinho de compras integrado à NAPP.',
    automationSupported: true,
    fields: [
      { inputKey: 'cnpj_cliente', templateKey: 'cnpjCliente', label: 'CNPJ do cliente' },
      { inputKey: 'nome_loja', templateKey: 'nomeDaLoja', label: 'Nome da loja' },
    ],
  },
  Cielo: {
    key: 'Cielo',
    name: 'Link de pagamento - Cielo',
    type: 'Integração',
    file: 'link_cielo.txt',
    description: 'Geração de links de pagamento Cielo.',
    automationSupported: true,
    fields: [
      { inputKey: 'cliente', templateKey: 'Cliente', label: 'Nome do cliente' },
      { inputKey: 'autenticacao', templateKey: 'autenticacao', label: 'Basic / autenticação Cielo' },
    ],
  },
  Cielo_webhook: {
    key: 'Cielo_webhook',
    name: 'Cielo Webhook (Notificação)',
    type: 'Automação',
    file: 'CieloWebhook.txt',
    description: 'Notificação automática de status de pagamento da Cielo.',
    automationSupported: true,
    fields: [
      { inputKey: 'client_api_key', templateKey: 'clientApiKey', label: 'API Key' },
      { inputKey: 'client_url', templateKey: 'clientUrl', label: 'Instância do cliente' },
    ],
  },
  Getnet: {
    key: 'Getnet',
    name: 'Link de pagamento - Getnet',
    type: 'Integração',
    file: 'Integracao_getnet.txt',
    description: 'Geração de links de pagamento Getnet.',
    automationSupported: true,
    fields: [
      { inputKey: 'credencial', templateKey: 'credencial', label: 'Credencial' },
    ],
  },
  Getnet_webhook: {
    key: 'Getnet_webhook',
    name: 'Webhook - Getnet',
    type: 'Automação',
    file: 'getnet_Webhook.txt',
    description: 'Automação de notificações de pagamento da Getnet.',
    automationSupported: true,
    fields: [
      { inputKey: 'queue_id', templateKey: 'queueId', label: 'ID da fila' },
      { inputKey: 'apikey', templateKey: 'apikey', label: 'API Key' },
      { inputKey: 'url', templateKey: 'url', label: 'URL da instância' },
    ],
  },
  transcricao_de_receitas: {
    key: 'transcricao_de_receitas',
    name: 'IA - Transcrição de receita',
    type: 'Ferramenta de IA',
    file: 'transcricao_de_receita.txt',
    description: 'Transcrição automática de receitas médicas.',
    automationSupported: true,
    fields: [],
  },
};

export const aiCatalog = {
  atendimento: {
    key: 'atendimento',
    name: 'IA - Atendimento',
    endpoint: '',
    description: 'IA genérica de atendimento ao cliente.',
    fields: [
      { inputKey: 'context', label: 'Contexto da IA' },
    ],
    defaultContext: DEFAULT_ATENDIMENTO_CONTEXT,
  },
  alpha7: {
    key: 'alpha7',
    name: 'IA - Alpha 7',
    endpoint: '/alpha',
    description: 'IA conectada ao ecossistema Alpha7.',
    fields: [
      { inputKey: 'nome_cliente', label: 'Nome do cliente (loja)' },
      { inputKey: 'apiKey', label: 'API Key' },
      { inputKey: 'porta_cliente', label: 'Porta da API' },
      { inputKey: 'unidade_negocio', label: 'Unidade de negócio' },
    ],
  },
  trier: {
    key: 'trier',
    name: 'IA - Trier',
    endpoint: '/trier',
    description: 'IA conectada ao ecossistema Trier.',
    fields: [
      { inputKey: 'nomeCliente', label: 'Nome da loja' },
      { inputKey: 'porta_cliente', label: 'Porta da API' },
      { inputKey: 'apiKey', label: 'API Key global' },
    ],
  },
  vannon: {
    key: 'vannon',
    name: 'IA - Vannon',
    endpoint: '/vannon',
    description: 'IA conectada ao ecossistema Vannon.',
    fields: [
      { inputKey: 'clientName', label: 'Nome da loja' },
      { inputKey: 'apiKey', label: 'API Key' },
      { inputKey: 'clientEndpoint', label: 'Endpoint do e-commerce' },
      { inputKey: 'cepLoja', label: 'CEP da loja' },
    ],
  },
  vetor: {
    key: 'vetor',
    name: 'IA - Vetor',
    endpoint: '/vetor',
    description: 'IA conectada ao ecossistema Vetor.',
    fields: [
      { inputKey: 'clientName', label: 'Nome da loja' },
      { inputKey: 'apiKey', label: 'API Key' },
      { inputKey: 'vetorToken', label: 'Token Vetor' },
    ],
  },
};

export function listAutomatableIntegrations() {
  return Object.values(integrationCatalog).filter(
    (item) => item.automationSupported,
  );
}

export function listAvailableIas() {
  return Object.values(aiCatalog);
}
