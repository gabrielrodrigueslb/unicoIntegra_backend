import path from 'path';
import { fileURLToPath } from 'url';
import fsExtra from 'fs-extra';
import { configurarExtensaoTrier } from '../functions/configureTrierExtension.js';
import { createLogService } from '../services/logs.services.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const downloadsDirectory = path.join(projectRoot, 'downloads');

function toReadableError(error) {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message;
    }

    if (typeof responseData.error === 'string' && responseData.error.trim()) {
      return responseData.error;
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      return 'Erro ao gerar a extensão Trier.';
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Erro interno ao gerar a extensão Trier.';
}

export async function generateTrierExtensionController(req, res) {
  let outputZipPath = null;

  try {
    const instance_url = String(
      req.body?.instance_url ?? req.body?.instanceUrl ?? '',
    ).trim();
    const client_token = String(
      req.body?.client_token ?? req.body?.clientToken ?? '',
    ).trim();
    const username = String(req.body?.username ?? '').trim() || 'Sistema';

    if (!instance_url) {
      return res
        .status(400)
        .json({ message: 'O campo "instance_url" é obrigatório.' });
    }

    if (!client_token) {
      return res
        .status(400)
        .json({ message: 'O campo "client_token" é obrigatório.' });
    }

    const result = await configurarExtensaoTrier({
      instance_url,
      client_token,
    });
    const fileName = result?.details?.fileName;

    if (!fileName) {
      throw new Error('A geração da extensão Trier não retornou o nome do ZIP.');
    }

    outputZipPath = path.join(downloadsDirectory, fileName);

    if (!(await fsExtra.pathExists(outputZipPath))) {
      throw new Error('O arquivo ZIP gerado não foi encontrado para download.');
    }

    await createLogService(
      username,
      `Gerou a extensão Trier - ${result.details?.extensionDisplayName || fileName}`,
      result.details?.normalizedInstanceUrl || instance_url,
    );

    return res.download(outputZipPath, fileName, async (error) => {
      if (error) {
        console.error('Erro ao enviar o ZIP da extensão Trier:', error);
      }

      if (outputZipPath && (await fsExtra.pathExists(outputZipPath))) {
        await fsExtra.remove(outputZipPath);
      }
    });
  } catch (error) {
    if (outputZipPath && (await fsExtra.pathExists(outputZipPath))) {
      await fsExtra.remove(outputZipPath);
    }

    console.error('Erro ao gerar extensão Trier:', error);
    const details = toReadableError(error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: `Ocorreu um erro ao gerar a extensão Trier. ${details}`,
        error: details,
      });
    }
  }
}
