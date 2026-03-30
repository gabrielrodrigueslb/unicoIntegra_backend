import { integrationCatalog, aiCatalog } from '../catalogs/linkAiCatalog.js';
import { loadAndParseTemplate } from './TemplateService.js';
import { installingIntegration } from './installing.services.js';
import {
  createAiAlpha,
  createAiTrier,
  createAiVannon,
  createAiVetor,
  createDefaultAi,
} from './ai.services.js';
import { createLogService } from './logs.services.js';

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function ensureExecutionContext(executionContext = {}) {
  const { authUsername, authPassword } = executionContext;

  if (!authUsername || !authPassword) {
    throw new Error(
      'A sessão do operador não está disponível. Faça login novamente antes de usar o Link AI.',
    );
  }

  return {
    authUsername,
    authPassword,
  };
}

function validateRequiredArgs(requiredFields, args) {
  const missingFields = requiredFields.filter(({ inputKey }) => {
    const value = args?.[inputKey];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missingFields.length) {
    const labels = missingFields.map((field) => field.label).join(', ');
    throw new Error(`Ainda faltam estes campos: ${labels}.`);
  }
}

function buildTemplateVariables(catalogFields, args) {
  return catalogFields.reduce((accumulator, field) => {
    const value = args?.[field.inputKey];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      accumulator[field.templateKey || field.inputKey] = value;
    }

    return accumulator;
  }, {});
}

export async function installIntegrationFromCatalog(args = {}, executionContext) {
  const catalog = integrationCatalog[args.template_key];

  if (!catalog) {
    throw new Error(`Integração não suportada: ${args.template_key}.`);
  }

  if (!catalog.automationSupported) {
    throw new Error(
      `${catalog.name} é um fluxo manual e não pode ser instalado automaticamente pelo chat.`,
    );
  }

  if (!args.instance || !String(args.instance).trim()) {
    throw new Error('Informe a URL da instância.');
  }

  if (!args.code || !String(args.code).trim()) {
    throw new Error('Informe o código 2FA da instância.');
  }

  validateRequiredArgs(catalog.fields, args);

  const context = ensureExecutionContext(executionContext);
  const instance = normalizeUrl(args.instance);
  const integrationData = await loadAndParseTemplate(
    catalog.file,
    buildTemplateVariables(catalog.fields, args),
  );

  const result = await installingIntegration(
    instance,
    context.authUsername,
    context.authPassword,
    String(args.code).trim(),
    integrationData,
  );

  await createLogService(
    context.authUsername,
    `Instalou ${catalog.name}`,
    instance,
    {
      generatedByAi: true,
      source: 'Link AI',
    },
  );

  return {
    sucesso: true,
    integrationKey: catalog.key,
    integrationName: catalog.name,
    traceMessage: `Instalando ${catalog.name}.`,
    resultSummary: `${catalog.name} instalada com sucesso.`,
    details: {
      instance,
      type: catalog.type,
    },
    result,
  };
}

export async function createAiFromCatalog(args = {}, executionContext) {
  const catalog = aiCatalog[args.template_key];

  if (!catalog) {
    throw new Error(`IA não suportada: ${args.template_key}.`);
  }

  if (!args.instance || !String(args.instance).trim()) {
    throw new Error('Informe a URL da instância.');
  }

  if (!args.code || !String(args.code).trim()) {
    throw new Error('Informe o código 2FA da instância.');
  }

  if (!args.name || !String(args.name).trim()) {
    throw new Error('Informe o nome da IA.');
  }

  const context = ensureExecutionContext(executionContext);
  const instance = normalizeUrl(args.instance);
  const code = String(args.code).trim();
  const name = String(args.name).trim();

  let result;

  switch (catalog.key) {
    case 'atendimento':
      result = await createDefaultAi(
        instance,
        context.authUsername,
        context.authPassword,
        code,
        name,
        args.context || catalog.defaultContext,
      );
      break;
    case 'alpha7':
      validateRequiredArgs(catalog.fields, args);
      result = await createAiAlpha({
        instance,
        username: context.authUsername,
        password: context.authPassword,
        code2fa: code,
        name,
        nome_cliente: args.nome_cliente,
        porta_cliente: args.porta_cliente,
        unidade_negocio: args.unidade_negocio,
        apiKey: args.apiKey,
      });
      break;
    case 'trier':
      validateRequiredArgs(catalog.fields, args);
      result = await createAiTrier({
        instance,
        username: context.authUsername,
        password: context.authPassword,
        code2fa: code,
        name,
        nome_cliente: args.nomeCliente,
        porta_cliente: args.porta_cliente,
        apiKey: args.apiKey,
      });
      break;
    case 'vannon':
      validateRequiredArgs(catalog.fields, args);
      result = await createAiVannon(
        instance,
        context.authUsername,
        context.authPassword,
        code,
        name,
        args.clientEndpoint,
        args.clientName,
        args.apiKey,
        args.cepLoja,
      );
      break;
    case 'vetor':
      validateRequiredArgs(catalog.fields, args);
      result = await createAiVetor(
        instance,
        context.authUsername,
        context.authPassword,
        code,
        name,
        args.vetorToken,
        args.clientName,
        args.apiKey,
      );
      break;
    default:
      throw new Error(`IA não suportada: ${catalog.key}.`);
  }

  await createLogService(
    context.authUsername,
    `Criou ${catalog.name} - ${name}`,
    instance,
    {
      generatedByAi: true,
      source: 'Link AI',
    },
  );

  return {
    sucesso: true,
    aiKey: catalog.key,
    aiName: catalog.name,
    traceMessage: `Criando ${catalog.name}.`,
    resultSummary: `${catalog.name} criada com sucesso.`,
    details: {
      instance,
      name,
    },
    result,
  };
}
