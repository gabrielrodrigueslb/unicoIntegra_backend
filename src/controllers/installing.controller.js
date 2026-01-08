// installing.controller.js
import { installingIntegration } from '../services/installing.services.js';

export async function installingIntegrations(req, res) {
  try {
    const { instance, username, password, code, integrationData } = req.body;

    if (!instance || !username || !password ) {
      return res.status(400).json({ 
        message: 'Credenciais (instance, username, password, code) são obrigatórias.' 
      });
    }

    if (!code) {
      return res.status(400).json({ message: 'O campo "code" é obrigatório' });
    }
    if (!integrationData) {
      return res.status(400).json({ message: 'O payload integrationData é obrigatório.' });
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
