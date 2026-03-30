import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  aiCatalog,
  integrationCatalog,
  listAutomatableIntegrations,
  listAvailableIas,
} from '../catalogs/linkAiCatalog.js';
import { platformNavigationCatalog } from '../catalogs/platformNavigationCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

let cachedDocuments = null;

function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripMarkdown(content = '') {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readDoc(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return stripMarkdown(fs.readFileSync(filePath, 'utf-8'));
}

function buildPlatformDocuments() {
  const docs = [
    {
      id: 'platform-navigation-overview',
      title: 'Mapa da plataforma',
      text: [
        'Quando orientar navegacao na plataforma, use links markdown com caminhos internos no formato [Rotulo](/main/rota).',
        `Areas principais disponiveis: ${platformNavigationCatalog
          .map((item) => `${item.name} (${item.path})`)
          .join(', ')}.`,
        'A tela de Bancos de Dados possui criacao de banco e teste de conexao PostgreSQL.',
        'A tela de Servicos centraliza o Pkg Generator e o modulo IA Services.',
        'A tela de IAs cria assistentes e a tela IAs Criadas lista snapshots/versoes por instancia.',
      ].join(' '),
    },
  ];

  for (const area of platformNavigationCatalog) {
    docs.push({
      id: `platform-${area.key}`,
      title: `${area.name} (${area.path})`,
      text: [
        area.summary,
        `Capacidades: ${area.capabilities.join(', ')}.`,
        `Ao indicar esta tela ao usuario, use o link markdown [${area.name}](${area.path}).`,
      ].join(' '),
    });
  }

  return docs;
}

function buildCatalogDocuments() {
  const docs = [];

  docs.push({
    id: 'overview',
    title: 'Visão geral do Link AI',
    text: [
      'O Link AI pode gerar build, instalar integrações do catálogo, instalar automações e criar IAs do catálogo atual.',
      `Integrações automatizáveis: ${listAutomatableIntegrations()
        .map((item) => item.name)
        .join(', ')}.`,
      `IAs disponíveis: ${listAvailableIas()
        .map((item) => item.name)
        .join(', ')}.`,
      'Alpha7 - Extensão é um fluxo manual e não deve ser instalado automaticamente pelo chat.',
    ].join(' '),
  });

  for (const integration of Object.values(integrationCatalog)) {
    docs.push({
      id: `integration-${integration.key}`,
      title: integration.name,
      text: [
        `Tipo: ${integration.type}.`,
        integration.description,
        integration.automationSupported
          ? 'Pode ser instalada automaticamente pelo endpoint /install/integration.'
          : 'Não pode ser instalada automaticamente pelo chat.',
        integration.fields.length
          ? `Campos necessários: ${integration.fields
              .map((field) => `${field.label} (${field.inputKey})`)
              .join(', ')}.`
          : 'Não exige campos adicionais além de instance e code.',
      ].join(' '),
    });
  }

  for (const ai of Object.values(aiCatalog)) {
    docs.push({
      id: `ai-${ai.key}`,
      title: ai.name,
      text: [
        ai.description,
        `Endpoint relacionado: /api/ia/create-ai${ai.endpoint || ''}.`,
        ai.fields.length
          ? `Campos específicos: ${ai.fields
              .map((field) => `${field.label} (${field.inputKey})`)
              .join(', ')}.`
          : 'Não exige campos específicos além de instance, code e name.',
        ai.defaultContext
          ? 'A IA de atendimento pode usar um contexto padrão se o usuário não fornecer um contexto personalizado.'
          : '',
      ].join(' '),
    });
  }

  return docs;
}

function getKnowledgeDocuments() {
  if (cachedDocuments) {
    return cachedDocuments;
  }

  cachedDocuments = [
    {
      id: 'api-doc',
      title: 'API do backend',
      text: readDoc('docs/API.md'),
    },
    {
      id: 'templates-guide',
      title: 'Guia de instalação de IAs e integrações',
      text: readDoc('docs/GUIA_IA_INSTALACAO_TEMPLATES.md'),
    },
    {
      id: 'trier-extension-guide',
      title: 'Guia da extensao Trier',
      text: readDoc('docs/GUIA_EXTENSAO_TRIER.md'),
    },
    ...buildPlatformDocuments(),
    ...buildCatalogDocuments(),
  ];

  return cachedDocuments;
}

function scoreDocument(document, queryTerms) {
  const haystack = normalizeText(`${document.title} ${document.text}`);

  return queryTerms.reduce((score, term) => {
    if (!term) {
      return score;
    }

    if (haystack.includes(term)) {
      return score + (normalizeText(document.title).includes(term) ? 4 : 1);
    }

    return score;
  }, 0);
}

export function buildKnowledgeBaseContext(query = '') {
  const documents = getKnowledgeDocuments();
  const normalizedTerms = Array.from(
    new Set(
      normalizeText(query)
        .split(/[^a-z0-9_]+/)
        .filter((term) => term.length >= 3),
    ),
  );

  const selectedDocuments = documents
    .map((document) => ({
      ...document,
      score: scoreDocument(document, normalizedTerms),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.id === 'overview' ? -1 : 1;
    })
    .slice(0, 5);

  const contextBlocks = selectedDocuments.map((document) => {
    const excerpt = document.text.slice(0, 1800);
    return `[${document.title}]\n${excerpt}`;
  });

  return contextBlocks.join('\n\n');
}
