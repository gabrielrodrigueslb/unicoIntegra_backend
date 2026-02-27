import { createAiAlpha, createAiVannon, createDefaultAi } from '../services/ai.services.js';
import {
  listAiTemplateBases,
  syncCurrentAiTemplatesToDb,
} from '../services/aiTemplateBase.services.js';
import { listAiVersions } from '../services/aiVersion.services.js';
import { createLogService } from '../services/logs.services.js';

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
      return 'Erro de integração ao criar IA.';
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Erro interno ao criar IA.';
}

export async function createAiAlphaController(req, res) {
  try {
    // 1. Obter todos os dados do body
    const {
      instance,
      username,
      password,
      name,
      context,
      clientIp,
      clientPort,
      unidade_negocio,
      apiKey,
      queueId,
      code,
    } = req.body;

    // 2. Validar campos obrigatórios
    if (!instance) {
      return res
        .status(400)
        .json({ message: 'O campo "instance" é obrigatório' });
    }
    if (!username) {
      return res
        .status(400)
        .json({ message: 'O campo "username" é obrigatório' });
    }
    if (!password) {
      return res
        .status(400)
        .json({ message: 'O campo "password" é obrigatório' });
    }
    if (!name) {
      return res
        .status(400)
        .json({ message: 'O campo "name" (signaturename) é obrigatório' });
    }
    if (!queueId) {
      return res
        .status(400)
        .json({ message: 'O campo "queueId" é obrigatório' });
    }
    if (!apiKey) {
      return res
        .status(400)
        .json({ message: 'O campo "apiKey" é obrigatório' });
    }
    if (!code) {
      return res.status(400).json({ message: 'O campo "code" é obrigatório' });
    }

    // 3. Chamar a função correta (createAiAlpha) com todos os parâmetros
    const aiResponse = await createAiAlpha(
      instance,
      username,
      password,
      code,
      name,
      context,
      clientIp,
      clientPort,
      unidade_negocio,
      apiKey,
      queueId,
    );
    const currentUser = username || 'Sistema';
    await createLogService(
      currentUser,
      `Criou a IA do alpha 7 - ${name}`,
      instance,
    );

    // 4. Retornar a resposta de sucesso
    res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Erro ao criar IA:', error);
    const details = toReadableError(error);
    res.status(500).json({
      message: `Ocorreu um erro ao criar a IA. ${details}`,
      error: details,
    });
  }
}

export async function createAiVannonController(req, res) {
  try {
    // 1. Obter todos os dados do body
    const {
      instance,
      username,
      password,
      name,
      context,
      clientEndpoint,
      apiKey,
      queueId,
      code,
      cepLoja,
      clientName
    } = req.body;

    // 2. Validar campos obrigatórios
    if (!instance) {
      return res
        .status(400)
        .json({ message: 'O campo "instance" é obrigatório' });
    }
    if (!username) {
      return res
        .status(400)
        .json({ message: 'O campo "username" é obrigatório' });
    }
    if (!password) {
      return res
        .status(400)
        .json({ message: 'O campo "password" é obrigatório' });
    }
    if (!name) {
      return res
        .status(400)
        .json({ message: 'O campo "name" (signaturename) é obrigatório' });
    }
    if (!queueId) {
      return res
        .status(400)
        .json({ message: 'O campo "queueId" é obrigatório' });
    }
    if (!apiKey) {
      return res
        .status(400)
        .json({ message: 'O campo "apiKey" é obrigatório' });
    }
    if (!code) {
      return res.status(400).json({ message: 'O campo "code" é obrigatório' });
    }

    // 3. Chamar a função correta (createAiAlpha) com todos os parâmetros
    const aiResponse = await createAiVannon(
      instance,
      username,
      password,
      code,
      name,
      context,
      clientEndpoint,
      clientName,
      apiKey,
      queueId,
      cepLoja
    );
    const currentUser = username || 'Sistema';
    await createLogService(
      currentUser,
      `Criou a IA da Vannon - ${name}`,
      instance,
    );

    // 4. Retornar a resposta de sucesso
    res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Erro ao criar IA:', error);
    const details = toReadableError(error);
    res.status(500).json({
      message: `Ocorreu um erro ao criar a IA. ${details}`,
      error: details,
    });
  }
}

export async function createAiController(req, res) {
  try {
    // 1. Obter todos os dados do body
    const { instance, username, password, code, name, context } = req.body;

    // 2. Validar campos obrigatórios
    if (!instance) {
      return res
        .status(400)
        .json({ message: 'O campo "instance" é obrigatório' });
    }
    if (!username) {
      return res
        .status(400)
        .json({ message: 'O campo "username" (username) é obrigatório' });
    }
    if (!password) {
      return res
        .status(400)
        .json({ message: 'O campo "password" (signaturename) é obrigatório' });
    }
    if (!name) {
      return res
        .status(400)
        .json({ message: 'O campo "name" (signaturename) é obrigatório' });
    }
    if (!context) {
      return res
        .status(400)
        .json({ message: 'O campo "context" é obrigatório' });
    }
    if (!code) {
      return res.status(400).json({ message: 'O campo "code" é obrigatório' });
    }

    // 3. Chamar a função correta (createAiAlpha) com todos os parâmetros
    const aiResponse = await createDefaultAi(
      instance,
      username,
      password,
      code,
      name,
      context,
    );
    const currentUser = username || 'Sistema';
    await createLogService(
      currentUser,
      `Criou a IA de atendimento - ${name}`,
      instance,
    );

    // 4. Retornar a resposta de sucesso
    res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Erro ao criar IA:', error);
    const details = toReadableError(error);
    res.status(500).json({
      message: `Ocorreu um erro ao criar a IA. ${details}`,
      error: details,
    });
  }
}

export async function listAiVersionsController(req, res) {
  try {
    const { limit, latestOnly, instance } = req.query;
    const data = await listAiVersions({ limit, latestOnly, instance });
    return res.status(200).json({ data });
  } catch (error) {
    console.error('Erro ao listar IAs versionadas:', error);
    return res.status(500).json({
      message: 'Ocorreu um erro ao listar as IAs.',
      error: error.message,
    });
  }
}

export async function listAiTemplatesController(req, res) {
  try {
    const { limit, currentOnly } = req.query;
    const data = await listAiTemplateBases({ limit, currentOnly });
    return res.status(200).json({ data });
  } catch (error) {
    console.error('Erro ao listar templates base de IA:', error);
    return res.status(500).json({
      message: 'Ocorreu um erro ao listar os templates base de IA.',
      error: error.message,
    });
  }
}

export async function syncAiTemplatesController(req, res) {
  try {
    const data = await syncCurrentAiTemplatesToDb();
    return res.status(200).json({
      message: 'Templates base de IA sincronizados com sucesso.',
      data,
    });
  } catch (error) {
    console.error('Erro ao sincronizar templates base de IA:', error);
    return res.status(500).json({
      message: 'Ocorreu um erro ao sincronizar templates base de IA.',
      error: error.message,
    });
  }
}
