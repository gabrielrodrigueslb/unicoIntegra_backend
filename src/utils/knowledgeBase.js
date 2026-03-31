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

const DOC_ROUTE_BASE = '/main/docs';
const BACK_DOCS_DIR = path.join(projectRoot, 'docs');
const FRONT_DOCS_DIR = path.join(projectRoot, '..', 'front', 'src', 'pages', 'Docs');
const FRONT_DOCS_CONTENT_DIR = path.join(FRONT_DOCS_DIR, 'content');
const FRONT_DOCS_ROUTER_FILE = path.join(FRONT_DOCS_DIR, 'DocsRouter.tsx');
const BACK_DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);
const FRONT_DOC_EXTENSIONS = new Set(['.md', '.mdx', '.ts', '.tsx']);
const FRONT_FALLBACK_DOC_FILES = [
  path.join(FRONT_DOCS_DIR, 'index.tsx'),
  path.join(FRONT_DOCS_DIR, 'Changelog.tsx'),
  path.join(FRONT_DOCS_DIR, 'Erros.tsx'),
];

let cachedFilesystemDocuments = null;
let cachedFilesystemSignature = '';

function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripMarkdown(content = '') {
  return content
    .replace(/^---[\s\S]*?---\s*/m, ' ')
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, ' ')
    .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, ' ')
    .replace(/^\s*export\s+\{[\s\S]*?\}\s*;?\s*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSourceDocument(content = '') {
  const extractedTagProps = [];
  const tagPropRegex =
    /\b(?:badge|title|description|label|summary|method|path|to)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{`([\s\S]*?)`\}|\{"([^"]+)"\}|\{'([^']+)'\})/g;

  for (const match of content.matchAll(tagPropRegex)) {
    const value = match[1] || match[2] || match[3] || match[4] || match[5] || '';

    if (value.trim()) {
      extractedTagProps.push(value.trim());
    }
  }

  return [
    extractedTagProps.join(' '),
    content
      .replace(/^---[\s\S]*?---\s*/m, ' ')
      .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, ' ')
      .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, ' ')
      .replace(/^\s*export\s+default\s+/gm, ' ')
      .replace(/^\s*export\s+\{[\s\S]*?\}\s*;?\s*$/gm, ' ')
      .replace(/\bclassName\s*=\s*(?:"[^"]*"|'[^']*'|\{[\s\S]*?\})/g, ' ')
      .replace(/\bstyle\s*=\s*\{\{[\s\S]*?\}\}/g, ' ')
      .replace(/\bon[A-Z][A-Za-z]*\s*=\s*(?:"[^"]*"|'[^']*'|\{[\s\S]*?\})/g, ' ')
      .replace(/\bkey\s*=\s*(?:"[^"]*"|'[^']*'|\{[\s\S]*?\})/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, ' $1 ')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ' $1 ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, ' $1 $2 ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#123;/g, '{')
      .replace(/&#125;/g, '}')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\b(?:const|let|var|return|interface|type|export|default|extends|implements)\b/g, ' ')
      .replace(/\bReact\.FC\b/g, ' ')
      .replace(/[{}[\]();,]+/g, ' ')
      .replace(/=>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimToPrimaryMarkdownHeading(content = '') {
  const headingIndex = content.search(/^\s*#\s+/m);

  if (headingIndex === -1) {
    return content;
  }

  return content.slice(headingIndex);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function toPosixPath(value = '') {
  return value.replace(/\\/g, '/');
}

function humanizeName(value = '') {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifySegment(value = '') {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFallbackTitle(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));

  if (fileName.toLowerCase() !== 'index') {
    return humanizeName(fileName);
  }

  return humanizeName(path.basename(path.dirname(filePath)));
}

function extractDocumentTitle(filePath, rawContent, documentText) {
  const markdownHeadingMatch = rawContent.match(/^\s*#\s+(.+)$/m);

  if (markdownHeadingMatch?.[1]?.trim()) {
    return stripMarkdown(markdownHeadingMatch[1]).slice(0, 120);
  }

  const titlePropMatch = rawContent.match(
    /\btitle\s*=\s*(?:"([^"]+)"|'([^']+)'|\{`([\s\S]*?)`\}|\{"([^"]+)"\}|\{'([^']+)'\})/,
  );

  if (titlePropMatch) {
    const titleValue =
      titlePropMatch[1] ||
      titlePropMatch[2] ||
      titlePropMatch[3] ||
      titlePropMatch[4] ||
      titlePropMatch[5] ||
      '';

    if (titleValue.trim()) {
      return titleValue.trim().slice(0, 120);
    }
  }

  const headingTagMatch = rawContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (headingTagMatch?.[1]?.trim()) {
    return stripMarkdown(headingTagMatch[1]).slice(0, 120);
  }

  const normalizedText = documentText.replace(/\s+/g, ' ').trim();
  const firstSentenceMatch = normalizedText.match(/^(.+?)(?:[.:!?](?:\s|$)|$)/);

  if (firstSentenceMatch?.[1]?.trim()) {
    return firstSentenceMatch[1].trim().slice(0, 120);
  }

  return buildFallbackTitle(filePath);
}

function resolveImportPath(baseFilePath, importPath) {
  const normalizedBase = path.dirname(baseFilePath);
  const rawCandidate = path.resolve(normalizedBase, importPath);
  const extension = path.extname(rawCandidate);

  if (extension && fileExists(rawCandidate)) {
    return rawCandidate;
  }

  for (const candidateExtension of ['.tsx', '.ts', '.mdx', '.md', '.jsx', '.js']) {
    const candidate = `${rawCandidate}${candidateExtension}`;

    if (fileExists(candidate)) {
      return candidate;
    }
  }

  const indexCandidates = ['index.tsx', 'index.ts', 'index.mdx', 'index.md'];

  for (const candidateFileName of indexCandidates) {
    const candidate = path.join(rawCandidate, candidateFileName);

    if (fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function listFilesRecursively(rootDir, allowedExtensions) {
  if (!fileExists(rootDir)) {
    return [];
  }

  const files = [];
  const pendingDirectories = [rootDir];

  while (pendingDirectories.length) {
    const currentDir = pendingDirectories.pop();
    const directoryEntries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of directoryEntries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function parseFrontDocsRouter() {
  if (!fileExists(FRONT_DOCS_ROUTER_FILE)) {
    return new Map();
  }

  const routerSource = fs.readFileSync(FRONT_DOCS_ROUTER_FILE, 'utf-8');
  const importMap = new Map();
  const routeMap = new Map();
  const importRegex = /^\s*import\s+([A-Za-z0-9_]+)\s+from\s+['"](.+?)['"]\s*;?\s*$/gm;

  for (const match of routerSource.matchAll(importRegex)) {
    const componentName = match[1];
    const importPath = match[2];

    if (!importPath.startsWith('.')) {
      continue;
    }

    const resolvedPath = resolveImportPath(FRONT_DOCS_ROUTER_FILE, importPath);

    if (resolvedPath) {
      importMap.set(componentName, resolvedPath);
    }
  }

  const indexRouteRegex = /<Route\s+index\s+element=\{<([A-Za-z0-9_]+)\s*\/?>\}\s*\/>/g;

  for (const match of routerSource.matchAll(indexRouteRegex)) {
    const componentName = match[1];
    const componentPath = importMap.get(componentName);

    if (componentPath) {
      routeMap.set(componentPath, DOC_ROUTE_BASE);
    }
  }

  const pathRouteRegex = /<Route\s+path="([^"]+)"\s+element=\{<([A-Za-z0-9_]+)\s*\/?>\}\s*\/>/g;

  for (const match of routerSource.matchAll(pathRouteRegex)) {
    const routeSuffix = match[1];
    const componentName = match[2];
    const componentPath = importMap.get(componentName);

    if (componentPath) {
      routeMap.set(componentPath, `${DOC_ROUTE_BASE}/${routeSuffix}`);
    }
  }

  return routeMap;
}

function deriveFrontDocsRoute(filePath) {
  if (filePath === path.join(FRONT_DOCS_DIR, 'index.tsx')) {
    return DOC_ROUTE_BASE;
  }

  if (filePath === path.join(FRONT_DOCS_DIR, 'Changelog.tsx')) {
    return `${DOC_ROUTE_BASE}/changelog`;
  }

  if (filePath === path.join(FRONT_DOCS_DIR, 'Erros.tsx')) {
    return `${DOC_ROUTE_BASE}/erros`;
  }

  const relativePath = toPosixPath(path.relative(FRONT_DOCS_CONTENT_DIR, filePath));

  if (relativePath.startsWith('..')) {
    return null;
  }

  const pathSegments = relativePath.split('/');
  const fileName = pathSegments.pop() || '';
  const bareFileName = fileName.replace(/\.[^.]+$/, '');
  const routeSegments = pathSegments.map(slugifySegment).filter(Boolean);

  if (bareFileName.toLowerCase() !== 'index') {
    routeSegments.push(slugifySegment(bareFileName));
  }

  return routeSegments.length
    ? `${DOC_ROUTE_BASE}/${routeSegments.join('/')}`
    : DOC_ROUTE_BASE;
}

function buildFileDocument(filePath, route) {
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const extension = path.extname(filePath).toLowerCase();
  const primaryContent =
    extension === '.mdx' ? trimToPrimaryMarkdownHeading(rawContent) : rawContent;
  const documentText =
    extension === '.ts' || extension === '.tsx'
      ? stripSourceDocument(rawContent)
      : extension === '.mdx'
        ? stripSourceDocument(primaryContent)
        : stripMarkdown(rawContent);

  if (!documentText) {
    return null;
  }

  const relativePath = toPosixPath(path.relative(projectRoot, filePath));
  const title = extractDocumentTitle(filePath, rawContent, documentText);
  const routeText = route
    ? `Rota interna de documentacao: ${route}.`
    : 'Documento de referencia sem rota interna publicada.';

  return {
    id: `doc-${normalizeText(relativePath).replace(/[^a-z0-9]+/g, '-')}`,
    title,
    text: `${routeText} Arquivo fonte: ${relativePath}. ${documentText}`.trim(),
  };
}

function getFilesystemKnowledgeDocuments() {
  const routerRouteMap = parseFrontDocsRouter();
  const backDocFiles = listFilesRecursively(BACK_DOCS_DIR, BACK_DOC_EXTENSIONS);
  const frontContentFiles = listFilesRecursively(
    FRONT_DOCS_CONTENT_DIR,
    FRONT_DOC_EXTENSIONS,
  );
  const docFiles = new Map();

  for (const filePath of backDocFiles) {
    docFiles.set(filePath, {
      filePath,
      route: null,
    });
  }

  for (const [filePath, route] of routerRouteMap.entries()) {
    docFiles.set(filePath, {
      filePath,
      route,
    });
  }

  for (const filePath of FRONT_FALLBACK_DOC_FILES) {
    if (!fileExists(filePath)) {
      continue;
    }

    docFiles.set(filePath, {
      filePath,
      route: routerRouteMap.get(filePath) || deriveFrontDocsRoute(filePath),
    });
  }

  for (const filePath of frontContentFiles) {
    const currentEntry = docFiles.get(filePath);

    docFiles.set(filePath, {
      filePath,
      route: currentEntry?.route || routerRouteMap.get(filePath) || deriveFrontDocsRoute(filePath),
    });
  }

  const sortedEntries = Array.from(docFiles.values()).sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  );

  const signature = sortedEntries
    .map(({ filePath, route }) => {
      const stats = fs.statSync(filePath);
      return [
        toPosixPath(path.relative(projectRoot, filePath)),
        route || '',
        stats.size,
        Math.trunc(stats.mtimeMs),
      ].join(':');
    })
    .join('|');

  if (
    cachedFilesystemDocuments &&
    cachedFilesystemSignature === signature
  ) {
    return cachedFilesystemDocuments;
  }

  cachedFilesystemDocuments = sortedEntries
    .map(({ filePath, route }) => buildFileDocument(filePath, route))
    .filter(Boolean);
  cachedFilesystemSignature = signature;

  return cachedFilesystemDocuments;
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
        'A tela de IAs cria assistentes e a tela IAs Criadas lista snapshots e versoes por instancia.',
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
    title: 'Visao geral do Link AI',
    text: [
      'O Link AI pode gerar build, instalar integracoes do catalogo, instalar automacoes e criar IAs do catalogo atual.',
      `Integracoes automatizaveis: ${listAutomatableIntegrations()
        .map((item) => item.name)
        .join(', ')}.`,
      `IAs disponiveis: ${listAvailableIas()
        .map((item) => item.name)
        .join(', ')}.`,
      'Alpha7 - Extensao e um fluxo manual e nao deve ser instalado automaticamente pelo chat.',
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
          : 'Nao pode ser instalada automaticamente pelo chat.',
        integration.fields.length
          ? `Campos necessarios: ${integration.fields
              .map((field) => `${field.label} (${field.inputKey})`)
              .join(', ')}.`
          : 'Nao exige campos adicionais alem de instance e code.',
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
          ? `Campos especificos: ${ai.fields
              .map((field) => `${field.label} (${field.inputKey})`)
              .join(', ')}.`
          : 'Nao exige campos especificos alem de instance, code e name.',
        ai.defaultContext
          ? 'A IA de atendimento pode usar um contexto padrao se o usuario nao fornecer um contexto personalizado.'
          : '',
      ].join(' '),
    });
  }

  return docs;
}

function getKnowledgeDocuments() {
  return [
    ...getFilesystemKnowledgeDocuments(),
    ...buildPlatformDocuments(),
    ...buildCatalogDocuments(),
  ];
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
