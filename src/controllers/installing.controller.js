// installing.controller.js
import { installingIntegration } from '../services/installing.services.js';

export async function installingIntegrations(req, res) {
  try {
    const { instance, username, password, code, integrationData } = req.body;

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

    if (!code) {
      return res.status(400).json({ message: 'O campo "code" é obrigatório' });
    }

    const result = await installingIntegration(
      instance,
      username,
      password,
      code,
      integrationData,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error('Erro no processo de instalação:', error);
    res.status(500).json({
      message: 'Ocorreu um erro durante a instalação da integração.',
      error: error.message,
    });
  }
}
