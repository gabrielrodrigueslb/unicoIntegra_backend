// src/controllers/logs.controller.js
import { listLogsService } from '../services/logs.services.js';

/**
 * Controller para expor a listagem de logs via API (GET)
 */
export const getLogs = async (req, res) => {
  try {
    // Extrai os query params da URL (ex: ?page=1&search=teste)
    const { page, limit, search, startDate, endDate } = req.query;

    // Chama o serviço passando apenas os dados necessários
    const result = await listLogsService({
      page,
      limit,
      search,
      startDate,
      endDate
    });

    // Retorna o JSON formatado
    return res.json(result);

  } catch (error) {
    console.error("CONTROLLER ERROR:", error);
    return res.status(500).json({ 
      error: 'Erro interno ao processar a busca de logs.' 
    });
  }
};