import { createAiAlpha, createDefaultAi } from '../services/ai.services.js';

export async function createAiAlphaController(req, res) {
  try {
    // 1. Obter todos os dados do body
    const {
      instance,
      username,
      password,
      name,
      context,
      dbName,
      queueId,
      apiKey,
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
    if (!dbName) {
      return res
        .status(400)
        .json({ message: 'O campo "dbName" é obrigatório' });
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
      dbName,
      queueId,
      apiKey,
    );

    // 4. Retornar a resposta de sucesso
    res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Erro ao criar IA:', error);
    res.status(500).json({
      message: 'Ocorreu um erro ao criar a IA.',
      error: error.message,
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

    // 4. Retornar a resposta de sucesso
    res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Erro ao criar IA:', error);
    res.status(500).json({
      message: 'Ocorreu um erro ao criar a IA.',
      error: error.message,
    });
  }
}
