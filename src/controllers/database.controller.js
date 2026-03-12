import {
  checkExtensionDatabaseStatus,
  createDatabase,
  listDatabases,
  testDatabaseConnection,
} from '../services/database.services.js';
import { createLogService } from '../services/logs.services.js';

export async function getDatabases(req, res) {
  try {
    const { page, limit, search } = req.query;
    const result = await listDatabases(page, limit, search);

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar bancos' });
  }
}

export async function createDatabaseController(req, res) {
  try {
    const { name, username } = req.body;
    const currentUser = username || 'Sistema';

    if (!name) {
      return res.status(400).json({ error: 'Nome do banco e obrigatorio' });
    }

    const result = await createDatabase(name);

    await createLogService(currentUser, `Criou o banco ${name}`, name);

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    const errorMessage = error.message || 'Erro ao criar banco';

    if (errorMessage.toLowerCase().includes('existe')) {
      return res.status(409).json({ error: errorMessage });
    }

    return res.status(500).json({ error: errorMessage });
  }
}

export async function testDatabaseConnectionController(req, res) {
  try {
    const { username, ...connectionConfig } = req.body;
    const currentUser = username || 'Sistema';
    const result = await testDatabaseConnection(connectionConfig);

    try {
      await createLogService(
        currentUser,
        `Testou conexao com o banco ${connectionConfig.database} em ${connectionConfig.host}:${connectionConfig.port}`,
        connectionConfig.database || connectionConfig.host,
      );
    } catch (logError) {
      console.warn(
        'Falha ao registrar log do teste de conexao:',
        logError?.message || logError,
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao testar conexao com o banco:', error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || 'Erro ao testar conexao com o banco.',
    });
  }
}

export async function checkExtensionDatabaseStatusController(req, res) {
  try {
    const { username, database } = req.body;
    const currentUser = username || 'Sistema';
    const result = await checkExtensionDatabaseStatus(database);

    try {
      const statusLabel = result.readyForIntegration ? 'pronto' : 'pendente';

      await createLogService(
        currentUser,
        `Verificou o status da integracao do banco ${database}: ${statusLabel}`,
        database,
      );
    } catch (logError) {
      console.warn(
        'Falha ao registrar log da verificacao do banco:',
        logError?.message || logError,
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao verificar status da integracao do banco:', error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || 'Erro ao verificar status da integracao do banco.',
    });
  }
}
