// src/services/logs.service.js

import { prisma } from '../../prisma/PrismaClient.js';

/**
 * Cria um registro de log no banco de dados.
 * @param {string} userName - Nome do usuário
 * @param {string} action - Ação realizada
 * @param {string} target - Alvo da ação (opcional)
 */
export const createLogService = async (userName, action, target = null) => {
  try {
    await prisma.systemLog.create({
      data: {
        userName,
        action,
        target
      }
    });
  } catch (error) {
    // Apenas logamos o erro no console para não parar o fluxo crítico do sistema
    console.error("SERVICE ERROR: Falha ao criar log:", error);
  }
};

/**
 * Busca logs com paginação e filtros.
 * @param {Object} params - Objeto com page, limit, search, startDate, endDate
 */
export const listLogsService = async ({ page = 1, limit = 10, search, startDate, endDate }) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Construção do filtro (WHERE)
  const where = {};

  if (search) {
    where.OR = [
      { userName: { contains: search, mode: 'insensitive' } },
      { action: { contains: search, mode: 'insensitive' } },
      { target: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    
    if (endDate) {
      // Ajusta para o final do dia
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Transaction para buscar dados e contagem total
  try {
    // OTIMIZAÇÃO: Promise.all roda as duas queries EM PARALELO sem abrir transação.
    // Isso economiza o tempo de "handshake" da transação.
    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemLog.count({ where })
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1, // Evita divisão por zero ou 0 páginas
        limit: limitNum
      }
    };
  } catch (error) {
    console.error("Erro ao listar logs:", error);
    throw new Error("Falha ao buscar logs do sistema.");
  }
};