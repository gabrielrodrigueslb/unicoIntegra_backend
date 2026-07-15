import {
  createClient,
  deleteClient,
  getClient,
  getClientMultiProviderApiKey,
  listClients,
  setupClientMultiProvider,
  updateClient,
} from '../services/clients.service.js';

function resolveStatusCode(error, fallback = 500) {
  if (error?.statusCode) return error.statusCode;
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('nao encontrado')) return 404;
  if (message.includes('informe') || message.includes('ja existe')) return 400;

  return fallback;
}

export async function listClientsController(req, res) {
  try {
    const result = await listClients(req.query || {});
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
}

export async function getClientController(req, res) {
  try {
    const result = await getClient(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao carregar cliente.',
    });
  }
}

export async function getClientMultiProviderApiKeyController(req, res) {
  try {
    const result = await getClientMultiProviderApiKey(req.params.id, req.query?.username);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao consultar API key do cliente.',
    });
  }
}

export async function setupClientMultiProviderController(req, res) {
  try {
    const result = await setupClientMultiProvider(req.params.id, req.body?.username);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao realizar o setup multi-provider.',
    });
  }
}

export async function createClientController(req, res) {
  try {
    const client = await createClient(req.body || {});
    return res.status(201).json(client);
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao criar cliente.',
    });
  }
}

export async function updateClientController(req, res) {
  try {
    const client = await updateClient(req.params.id, req.body || {});
    return res.json(client);
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao atualizar cliente.',
    });
  }
}

export async function deleteClientController(req, res) {
  try {
    const force = req.query?.force === 'true' || req.body?.force === true;
    await deleteClient(req.params.id, req.body?.username, { force });
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return res.status(resolveStatusCode(error, 500)).json({
      error: error.message || 'Erro ao excluir cliente.',
      jobCount: error.jobCount,
    });
  }
}
