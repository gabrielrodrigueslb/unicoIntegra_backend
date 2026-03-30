export const platformNavigationCatalog = [
  {
    key: 'home',
    name: 'Inicio',
    path: '/main/home',
    summary:
      'Painel inicial com atalhos rapidos, cards operacionais e novidades da plataforma.',
    capabilities: [
      'acessar atalhos para bancos, extensoes, IAs e servicos',
      'acompanhar novidades e resumo operacional',
    ],
  },
  {
    key: 'link-ai',
    name: 'Link AI',
    path: '/main/link-ai',
    summary:
      'Assistente operacional para orientar o operador e executar tarefas via chat.',
    capabilities: [
      'tirar duvidas sobre a plataforma',
      'gerar build, instalar integracoes e criar IAs quando houver dados suficientes',
    ],
  },
  {
    key: 'databases',
    name: 'Bancos de Dados',
    path: '/main/databases',
    summary:
      'Gerenciador de bancos com listagem, criacao e teste de conexao PostgreSQL.',
    capabilities: [
      'criar novo banco',
      'buscar bancos existentes',
      'testar conexao PostgreSQL com host, porta, banco, usuario e senha',
      'consultar unidade de negocio por CNPJ durante o teste, quando informado',
    ],
  },
  {
    key: 'applications',
    name: 'Servicos',
    path: '/main/aplications',
    summary:
      'Hub de servicos operacionais da plataforma.',
    capabilities: [
      'acessar o Pkg Generator',
      'acessar o modulo de servicos/API das IAs',
    ],
  },
  {
    key: 'pkg-generator',
    name: 'Pkg Generator',
    path: '/main/aplications/pkg-generator',
    summary:
      'Modulo para gerar pacote ZIP do executavel Alpha 7 com configuracoes do cliente.',
    capabilities: [
      'gerar pacote customizado',
      'manter o fluxo legado de compilacao do executavel',
    ],
  },
  {
    key: 'ia-services',
    name: 'IA Services',
    path: '/main/aplications/ia-services',
    summary:
      'Modulo para gerenciar instancias dos servicos/API que alimentam as IAs.',
    capabilities: [
      'criar instancias',
      'acompanhar status operacional',
      'ver logs em tempo real',
      'reiniciar servicos',
    ],
  },
  {
    key: 'integrations',
    name: 'Integracoes',
    path: '/main/integrations',
    summary:
      'Catalogo de integracoes, automacoes e URAs com preview e instalacao guiada.',
    capabilities: [
      'visualizar templates ativos',
      'abrir preview de integracoes',
      'instalar integracoes com formulario guiado',
    ],
  },
  {
    key: 'automations',
    name: 'Automacoes',
    path: '/main/automations',
    summary:
      'Tela dedicada a automacoes da plataforma.',
    capabilities: [
      'acessar o catalogo de automacoes disponiveis',
    ],
  },
  {
    key: 'ia-page',
    name: 'IAs',
    path: '/main/iaPage',
    summary:
      'Catalogo de modelos de IA com formulario para criacao e configuracao.',
    capabilities: [
      'criar IA Alpha 7, Trier, Vannon, Vetor e Atendimento',
      'preencher configuracoes especificas por template',
    ],
  },
  {
    key: 'ia-page-list',
    name: 'IAs Criadas',
    path: '/main/iaPage/list',
    summary:
      'Listagem de snapshots e versoes de IAs por instancia.',
    capabilities: [
      'ver IAs criadas por instancia',
      'inspecionar payload salvo',
      'copiar JSON da versao',
    ],
  },
  {
    key: 'extensions',
    name: 'Extensoes',
    path: '/main/extensions',
    summary:
      'Gerenciamento de clientes, configuracoes e licencas das extensoes.',
    capabilities: [
      'cadastrar instancia',
      'criar configuracao vinculada a banco',
      'gerar licenca',
      'ativar, desativar, desvincular ou excluir licencas',
    ],
  },
  {
    key: 'docs',
    name: 'Documentacao',
    path: '/main/docs',
    summary:
      'Portal de documentacao interna da plataforma.',
    capabilities: [
      'consultar documentacao tecnica',
      'navegar por autenticacao, referencias e documentacao das IAs',
    ],
  },
  {
    key: 'docs-auth',
    name: 'Docs de Autenticacao',
    path: '/main/docs/getting-started/autenticacao',
    summary:
      'Pagina de documentacao sobre autenticacao.',
    capabilities: [
      'consultar o fluxo de autenticacao',
    ],
  },
  {
    key: 'docs-ias',
    name: 'Docs de IAs',
    path: '/main/docs/ias',
    summary:
      'Visao geral da documentacao de IAs da plataforma.',
    capabilities: [
      'comparar modelos de IA',
      'acessar paginas especificas de cada IA',
    ],
  },
  {
    key: 'docs-ias-alpha7',
    name: 'Docs IA Alpha 7',
    path: '/main/docs/ias/alpha7',
    summary:
      'Documentacao especifica da IA Alpha 7.',
    capabilities: [
      'consultar configuracao da IA Alpha 7',
    ],
  },
  {
    key: 'docs-ias-trier',
    name: 'Docs IA Trier',
    path: '/main/docs/ias/trier',
    summary:
      'Documentacao especifica da IA Trier.',
    capabilities: [
      'consultar configuracao da IA Trier',
    ],
  },
  {
    key: 'docs-ias-vannon',
    name: 'Docs IA Vannon',
    path: '/main/docs/ias/vannon',
    summary:
      'Documentacao especifica da IA Vannon.',
    capabilities: [
      'consultar configuracao da IA Vannon',
    ],
  },
  {
    key: 'docs-ias-vetor',
    name: 'Docs IA Vetor',
    path: '/main/docs/ias/vetor',
    summary:
      'Documentacao especifica da IA Vetor.',
    capabilities: [
      'consultar configuracao da IA Vetor',
    ],
  },
  {
    key: 'docs-ias-atendimento',
    name: 'Docs IA Atendimento',
    path: '/main/docs/ias/atendimento',
    summary:
      'Documentacao especifica da IA de Atendimento.',
    capabilities: [
      'consultar configuracao da IA de Atendimento',
    ],
  },
  {
    key: 'logs',
    name: 'Logs do sistema',
    path: '/main/logs',
    summary:
      'Tela de auditoria para consultar logs operacionais da plataforma.',
    capabilities: [
      'ver historico de acoes',
      'auditar operacoes realizadas na plataforma',
    ],
  },
];
