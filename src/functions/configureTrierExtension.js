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
    throw new Error('Informe a URL da instancia do cliente.');
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

async function pathExists(targetPath) {
  return fsExtra.pathExists(targetPath);
}

async function resolveTemplateSource() {
  const candidates = [
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
    if (await pathExists(candidate.path)) {
      return candidate;
    }
  }

  throw new Error(
    'Nao encontrei o template da extensao Trier. Verifique back/templates/trier-inovafarma ou configure TRIER_EXTENSION_TEMPLATE_DIR/TRIER_EXTENSION_TEMPLATE_ZIP no back/.env.',
  );
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
      'Extracao automatica do ZIP da extensao Trier ainda nao esta configurada para este sistema operacional. Em Linux, prefira TRIER_EXTENSION_TEMPLATE_DIR ou o template interno em back/templates/trier-inovafarma.',
    );
  }

  await runCommand('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`,
  ]);
}

async function prepareTemplateWorkspace(source, workingDirectory) {
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
    throw new Error('O build da extensao Trier nao gerou a pasta dist.');
  }

  return distDirectory;
}

export async function configurarExtensaoTrier(args = {}) {
  if (!args.instance_url || !String(args.instance_url).trim()) {
    throw new Error('Informe a URL da instancia do cliente.');
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
  const fileSlug = buildSafeFileSlug(normalizedInstanceUrl) || 'cliente';
  const buildId = `${fileSlug}-${Date.now()}`;
  const workingDirectory = path.join(temporaryBuildsDirectory, buildId);
  const zipFileName = `trier-extensao-${buildId}.zip`;
  const outputZipPath = path.join(downloadsDirectory, zipFileName);
  const traceSteps = [];

  await fsExtra.ensureDir(workingDirectory);

  try {
    const source = await resolveTemplateSource();
    traceSteps.push('Template da extensao Trier localizado.');

    await prepareTemplateWorkspace(source, workingDirectory);
    traceSteps.push('Codigo-fonte da extensao preparado para build.');

    await normalizePortugueseAssetNames(workingDirectory);
    traceSteps.push('Nomes de arquivos em portugues normalizados para UTF-8.');

    const distDirectory = await buildExtensionPackage({
      workingDirectory,
      envContent,
    });
    traceSteps.push('Variaveis de ambiente aplicadas ao build.');
    traceSteps.push('Dependencias instaladas.');
    traceSteps.push('Build da extensao concluido.');

    await createZipFromDirectory(distDirectory, outputZipPath);
    traceSteps.push('Arquivos da pasta dist empacotados em ZIP.');

    return {
      sucesso: true,
      extensionKey: 'trier',
      extensionName: 'Extensao Trier',
      traceMessage: 'Build da extensao Trier preparado para download.',
      traceSteps,
      resultSummary:
        'Extensao Trier gerada com sucesso. O ZIP do build ja esta disponivel para download.',
      env: {
        VITE_INSTANCE_URL: normalizedInstanceUrl,
        VITE_CLIENT_TOKEN: clientToken,
      },
      action: {
        type: 'download',
        url: `/downloads/${zipFileName}`,
        label: 'Baixar ZIP da extensao Trier',
      },
      details: {
        generatedAt,
        fileName: zipFileName,
        normalizedInstanceUrl,
      },
      rules: [
        'Se VITE_INSTANCE_URL vier sem / no final, ela sera normalizada automaticamente.',
        'O token deve ser o token de integracao da Trier.',
        'O ZIP contem apenas os arquivos finais do dist, prontos para instalar no navegador.',
      ],
    };
  } finally {
    await fsExtra.remove(workingDirectory);
  }
}
