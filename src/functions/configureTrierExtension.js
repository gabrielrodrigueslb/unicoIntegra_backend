import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fsExtra from 'fs-extra';
import archiver from 'archiver';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.join(__dirname, '..', '..');
const downloadsDirectory = path.join(workspaceRoot, 'downloads');
const embeddedTemplatesDirectory = path.join(workspaceRoot, 'templates');
const embeddedTrierTemplateDirectory = path.join(
  embeddedTemplatesDirectory,
  'trier-inovafarma',
);
const embeddedTrierTemplateZipPath = path.join(
  embeddedTemplatesDirectory,
  'trier-inovafarma.zip',
);
const temporaryBuildsDirectory = path.join(
  workspaceRoot,
  'builds-temporarios',
  'trier-extension',
);

function ensureTrailingSlash(url) {
  const trimmed = String(url || '').trim();

  if (!trimmed) {
    throw new Error('Informe a URL da instância do cliente.');
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function buildSafeFileSlug(url) {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .replace(/[^a-z0-9.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function sanitizeFileNameSegment(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '');
}

function buildInstanceDisplayName(url) {
  const trimmed = String(url || '').trim();

  if (!trimmed) {
    return 'cliente';
  }

  try {
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const { hostname } = new URL(normalized);
    return sanitizeFileNameSegment(hostname.replace(/^www\./i, '')) || 'cliente';
  } catch {
    return (
      sanitizeFileNameSegment(
        trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/g, ''),
      ) || 'cliente'
    );
  }
}

function buildTokenHint(token) {
  const trimmed = String(token || '').trim();

  if (!trimmed) {
    return 'token';
  }

  if (trimmed.length <= 8) {
    return sanitizeFileNameSegment(trimmed) || 'token';
  }

  return (
    sanitizeFileNameSegment(`${trimmed.slice(0, 4)}-${trimmed.slice(-4)}`) ||
    'token'
  );
}

function buildExtensionDisplayName(url, token) {
  return `${buildInstanceDisplayName(url)} ${buildTokenHint(token)}`;
}

function buildZipBaseName(url, token) {
  return `Trier extensão - ${buildExtensionDisplayName(url, token)}`;
}

async function pathExists(targetPath) {
  return fsExtra.pathExists(targetPath);
}

async function getAvailableDownloadTarget(baseName, extension = '.zip') {
  await fsExtra.ensureDir(downloadsDirectory);

  let attempt = 0;

  while (true) {
    const suffix = attempt === 0 ? '' : ` (${attempt + 1})`;
    const fileName = `${baseName}${suffix}${extension}`;
    const outputPath = path.join(downloadsDirectory, fileName);

    if (!(await pathExists(outputPath))) {
      return {
        fileName,
        outputPath,
      };
    }

    attempt += 1;
  }
}

async function resolveTemplateSource() {
  const candidates = [
    env.TRIER_EXTENSION_REPO_URL
      ? {
          type: 'repo',
          url: env.TRIER_EXTENSION_REPO_URL,
          branch: env.TRIER_EXTENSION_REPO_BRANCH || 'main',
        }
      : null,
    env.TRIER_EXTENSION_TEMPLATE_DIR
      ? { type: 'dir', path: env.TRIER_EXTENSION_TEMPLATE_DIR }
      : null,
    env.TRIER_EXTENSION_TEMPLATE_ZIP
      ? { type: 'zip', path: env.TRIER_EXTENSION_TEMPLATE_ZIP }
      : null,
    { type: 'dir', path: embeddedTrierTemplateDirectory },
    { type: 'zip', path: embeddedTrierTemplateZipPath },
    { type: 'dir', path: path.join(workspaceRoot, '.tmp', 'trier-inovafarma') },
    { type: 'zip', path: 'C:\\dev\\trier-inovafarma\\trier-inovafarma.zip' },
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.type === 'repo') {
      return candidate;
    }

    if (await pathExists(candidate.path)) {
      return candidate;
    }
  }

  throw new Error(
    'Não encontrei o template da extensão Trier. Verifique back/templates/trier-inovafarma ou configure TRIER_EXTENSION_TEMPLATE_DIR/TRIER_EXTENSION_TEMPLATE_ZIP no back/.env.',
  );
}

function getGitCommand() {
  return process.platform === 'win32' ? 'git.exe' : 'git';
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            stdout.trim() ||
            `Falha ao executar ${command} ${args.join(' ')}.`,
        ),
      );
    });
  });
}

async function extractZipToDirectory(zipPath, destinationPath) {
  if (process.platform !== 'win32') {
    throw new Error(
      'Extração automática do ZIP da extensão Trier ainda não está configurada para este sistema operacional. Em Linux, prefira TRIER_EXTENSION_TEMPLATE_DIR ou o template interno em back/templates/trier-inovafarma.',
    );
  }

  await runCommand('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`,
  ]);
}

async function cloneRepositoryToWorkspace(source, workingDirectory) {
  const gitCommand = getGitCommand();
  const cloneArgs = ['clone', '--depth', '1', '--single-branch'];

  if (source.branch) {
    cloneArgs.push('--branch', source.branch);
  }

  cloneArgs.push(source.url, '.');

  try {
    await runCommand(gitCommand, cloneArgs, {
      cwd: workingDirectory,
    });
  } catch (error) {
    throw new Error(
      `Falha ao clonar o repositorio da extensao Trier (${source.url}${
        source.branch ? `, branch ${source.branch}` : ''
      }). ${error.message}`,
    );
  }
}

async function prepareTemplateWorkspace(source, workingDirectory) {
  if (source.type === 'repo') {
    await cloneRepositoryToWorkspace(source, workingDirectory);
    await fsExtra.remove(path.join(workingDirectory, 'dist'));
    await fsExtra.remove(path.join(workingDirectory, '.git'));
    return;
  }

  if (source.type === 'dir') {
    await fsExtra.copy(source.path, workingDirectory, {
      filter: (itemPath) => {
        const normalizedPath = itemPath.replace(/\\/g, '/');

        return !(
          normalizedPath.includes('/node_modules') ||
          normalizedPath.includes('/dist') ||
          normalizedPath.includes('/.git')
        );
      },
    });
    return;
  }

  await extractZipToDirectory(source.path, workingDirectory);
  await fsExtra.remove(path.join(workingDirectory, 'dist'));
  await fsExtra.remove(path.join(workingDirectory, '.git'));
}

function describeTemplateSource(source) {
  if (source.type === 'repo') {
    return `Repositorio Git ${source.url}${
      source.branch ? ` (${source.branch})` : ''
    }`;
  }

  if (source.type === 'dir') {
    return `Diretorio local ${source.path}`;
  }

  return `Arquivo ZIP ${source.path}`;
}

async function normalizePortugueseAssetNames(workingDirectory) {
  const publicDirectory = path.join(workingDirectory, 'public');
  const brokenLogoPath = path.join(publicDirectory, 'logo-extensÆo.png');
  const normalizedLogoPath = path.join(publicDirectory, 'logo-extensão.png');

  if (
    (await pathExists(brokenLogoPath)) &&
    !(await pathExists(normalizedLogoPath))
  ) {
    await fsExtra.move(brokenLogoPath, normalizedLogoPath);
  }
}

async function createZipFromDirectory(sourceDirectory, outputZipPath) {
  await fsExtra.ensureDir(path.dirname(outputZipPath));

  await new Promise((resolve, reject) => {
    const output = fsExtra.createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.finalize();
  });
}

async function buildExtensionPackage({ workingDirectory, envContent }) {
  const npmCommand = getNpmCommand();
  const envFilePath = path.join(workingDirectory, '.env');
  const distDirectory = path.join(workingDirectory, 'dist');

  await fs.writeFile(envFilePath, envContent, 'utf8');

  const installArgs = (await pathExists(path.join(workingDirectory, 'package-lock.json')))
    ? ['ci']
    : ['install'];

  await runCommand(npmCommand, installArgs, {
    cwd: workingDirectory,
    env: {
      CI: 'true',
    },
  });

  await runCommand(npmCommand, ['run', 'build'], {
    cwd: workingDirectory,
    env: {
      CI: 'true',
    },
  });

  if (!(await pathExists(distDirectory))) {
    throw new Error('O build da extensão Trier não gerou a pasta dist.');
  }

  return distDirectory;
}

export async function configurarExtensaoTrier(args = {}) {
  if (!args.instance_url || !String(args.instance_url).trim()) {
    throw new Error('Informe a URL da instância do cliente.');
  }

  if (!args.client_token || !String(args.client_token).trim()) {
    throw new Error('Informe o token da Trier.');
  }

  const normalizedInstanceUrl = ensureTrailingSlash(args.instance_url);
  const clientToken = String(args.client_token).trim();
  const envContent = [
    `VITE_INSTANCE_URL="${normalizedInstanceUrl}"`,
    `VITE_CLIENT_TOKEN="${clientToken}"`,
  ].join('\n');
  const generatedAt = new Date().toISOString();
  const instanceDisplayName = buildInstanceDisplayName(normalizedInstanceUrl);
  const tokenHint = buildTokenHint(clientToken);
  const extensionDisplayName = buildExtensionDisplayName(
    normalizedInstanceUrl,
    clientToken,
  );
  const fileSlug = buildSafeFileSlug(normalizedInstanceUrl) || 'cliente';
  const buildId = `${fileSlug}-${Date.now()}`;
  const workingDirectory = path.join(temporaryBuildsDirectory, buildId);
  const downloadTarget = await getAvailableDownloadTarget(
    buildZipBaseName(normalizedInstanceUrl, clientToken),
  );
  const zipFileName = downloadTarget.fileName;
  const outputZipPath = downloadTarget.outputPath;
  const traceSteps = [];

  await fsExtra.ensureDir(workingDirectory);

  try {
    const source = await resolveTemplateSource();
    traceSteps.push(`Origem da extensao Trier definida: ${describeTemplateSource(source)}.`);
    traceSteps.push('Template da extensão Trier localizado.');

    await prepareTemplateWorkspace(source, workingDirectory);
    traceSteps.push('Código-fonte da extensão preparado para build.');

    await normalizePortugueseAssetNames(workingDirectory);
    traceSteps.push('Nomes de arquivos em português normalizados para UTF-8.');

    const distDirectory = await buildExtensionPackage({
      workingDirectory,
      envContent,
    });
    traceSteps.push('Variáveis de ambiente aplicadas ao build.');
    traceSteps.push('Dependências instaladas.');
    traceSteps.push('Build da extensão concluído.');

    await createZipFromDirectory(distDirectory, outputZipPath);
    traceSteps.push('Arquivos da pasta dist empacotados em ZIP.');

    return {
      sucesso: true,
      extensionKey: 'trier',
      extensionName: 'Extensão Trier',
      traceMessage: 'Build da extensão Trier preparado para download.',
      traceSteps,
      resultSummary:
        'Extensão Trier gerada com sucesso. O ZIP do build já está disponível para download.',
      env: {
        VITE_INSTANCE_URL: normalizedInstanceUrl,
        VITE_CLIENT_TOKEN: clientToken,
      },
      action: {
        type: 'download',
        url: `/downloads/${zipFileName}`,
        label: `Baixar ZIP - ${extensionDisplayName}`,
      },
      details: {
        generatedAt,
        fileName: zipFileName,
        normalizedInstanceUrl,
        instanceDisplayName,
        extensionDisplayName,
        tokenHint,
        sourceType: source.type,
        sourceRepositoryUrl: source.type === 'repo' ? source.url : null,
        sourceRepositoryBranch: source.type === 'repo' ? source.branch : null,
      },
      rules: [
        'Se VITE_INSTANCE_URL vier sem / no final, ela será normalizada automaticamente.',
        'O token deve ser o token de integração da Trier.',
        'O ZIP contém apenas os arquivos finais do dist, prontos para instalar no navegador.',
      ],
    };
  } finally {
    await fsExtra.remove(workingDirectory);
  }
}

export async function configurarExtensaoTrierLote(args = {}) {
  const rawItems = Array.isArray(args.items) ? args.items : [];
  const items = rawItems
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      instance_url: String(item.instance_url || '').trim(),
      client_token: String(item.client_token || '').trim(),
    }))
    .filter((item) => item.instance_url && item.client_token);

  if (!items.length) {
    throw new Error(
      'Informe ao menos uma extensão Trier com instance_url e client_token.',
    );
  }

  const results = [];
  const failures = [];
  const traceSteps = [];

  for (const [index, item] of items.entries()) {
    const instanceDisplayName = buildInstanceDisplayName(item.instance_url);
    const tokenHint = buildTokenHint(item.client_token);
    const extensionDisplayName = buildExtensionDisplayName(
      item.instance_url,
      item.client_token,
    );

    try {
      const result = await configurarExtensaoTrier(item);
      results.push({
        index: index + 1,
        instanceDisplayName,
        extensionDisplayName,
        tokenHint,
        ...result,
      });
      traceSteps.push(
        `Extensão Trier ${index + 1}/${items.length} gerada para ${extensionDisplayName}.`,
      );
    } catch (error) {
      const errorMessage = error?.message || 'Falha ao gerar a extensão Trier.';
      failures.push({
        index: index + 1,
        instance_url: item.instance_url,
        instanceDisplayName,
        extensionDisplayName,
        tokenHint,
        error: errorMessage,
      });
      traceSteps.push(
        `Falha na extensão Trier ${index + 1}/${items.length} para ${extensionDisplayName}: ${errorMessage}`,
      );
    }
  }

  const actions = results
    .map((result) => result.action)
    .filter((action) => action && action.url);
  const successCount = results.length;
  const failureCount = failures.length;
  const traceMessage =
    failureCount === 0
      ? `${successCount} extensão(ões) Trier geradas com sucesso.`
      : `${successCount} extensão(ões) Trier geradas e ${failureCount} com falha.`;

  return {
    sucesso: failureCount === 0,
    batch: true,
    traceMessage,
    traceSteps,
    resultSummary: traceMessage,
    results,
    failures,
    actions,
    action: actions[0] || null,
    details: {
      total: items.length,
      successCount,
      failureCount,
      generatedAt: new Date().toISOString(),
    },
  };
}
