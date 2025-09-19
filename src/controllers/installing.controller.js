// installing.controller.js
import { installingIntegration } from '../services/installing.services.js';

export async function installingIntegrations(req, res) {
  try {
    const { instance, integrationData } = req.body;

    if (!instance) {
      return res.status(400).json({ message: 'O campo "instance" é obrigatório' });
    }

    const result = await installingIntegration(instance, integrationData);
    res.status(200).json(result);
  } catch (error) {
    console.error('Erro no processo de instalação:', error);
    res.status(500).json({
      message: 'Ocorreu um erro durante a instalação da integração.',
      error: error.message,
    });
  }
}
