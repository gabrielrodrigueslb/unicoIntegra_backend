import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDirectory = path.join(__dirname, '..', '..', 'downloads');

export async function gerarBuildProjeto({
  nome_cliente,
  api_url,
} = {}) {
  if (!nome_cliente || !api_url) {
    throw new Error(
      'Os parametros nome_cliente e api_url sao obrigatorios para gerar o build.',
    );
  }

  await fs.mkdir(downloadsDirectory, { recursive: true });

  const generatedAt = new Date().toISOString();
  const previewPath = path.join(downloadsDirectory, 'build-preview.json');

  const previewContent = {
    nome_cliente,
    api_url,
    generatedAt,
    status: 'mock-build-generated',
    note: 'Este arquivo representa a simulacao de alteracao de env e geracao de build.',
  };

  await fs.writeFile(previewPath, JSON.stringify(previewContent, null, 2));

  logger.info('Mock de gerar_build_projeto executado.', {
    nome_cliente,
    api_url,
  });

  return {
    sucesso: true,
    downloadUrl: '/downloads/build.zip',
    action: {
      type: 'download',
      url: '/downloads/build.zip',
    },
    traceMessage: `Criando o build da aplicacao para ${nome_cliente}.`,
    details: {
      envPreview: {
        CLIENT_NAME: nome_cliente,
        API_URL: api_url,
      },
      generatedAt,
    },
  };
}
