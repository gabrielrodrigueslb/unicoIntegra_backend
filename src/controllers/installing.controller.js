import { installingIntegration } from '../services/installing.services.js';
import { isAutomatedInstanceAuthEnabled } from '../services/instanceExecutionAuth.services.js';
import { createLogService } from '../services/logs.services.js';

export async function installingIntegrations(req, res) {
  try {
    const {
      instance,
      integration,
      username,
      password,
      code,
      integrationData,
      requestedBy,
    } = req.body;

    if (!instance) {
      return res.status(400).json({
        message: 'O campo "instance" é obrigatório.',
      });
    }

    if (!isAutomatedInstanceAuthEnabled() && (!username || !password || !code)) {
      return res.status(400).json({
        message:
          'Credenciais da instância indisponíveis. Configure a conta técnica no backend ou informe username, password e code manualmente.',
      });
    }

    if (!integrationData) {
      return res.status(400).json({
        message: 'O payload integrationData é obrigatório.',
      });
    }

    const result = await installingIntegration(
      instance,
      username,
      password,
      code,
      integrationData,
    );

    const currentUser = requestedBy || username || 'Sistema';
    await createLogService(currentUser, `Instalou ${integration}`, instance);

    res.status(200).json(result);
  } catch (error) {
    console.error('Erro no processo de instalação:', error);
    res.status(500).json({
      message: 'Ocorreu um erro durante a instalação da integração.',
      error: error.message,
    });
  }
}
