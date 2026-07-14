import { prisma } from '../../prisma/PrismaClient.js';
import { createLogService } from './logs.services.js';
import {
  createMultiProviderClient,
  deleteMultiProviderClient,
} from './multiProviderClients.service.js';

const PROVIDERS = new Set(['api', 'file', 'alpha7']);
const DEFAULT_TRIER_API_URL =
  'https://api-sgf-gateway.triersistemas.com.br/sgfpod1/rest/integracao/produto/obter-todos-v1';

function maskCredentialHint(credential) {
  const value = String(credential || '');
  if (!value) return null;
  const visible = value.slice(0, 6);
  return value.length > 6 ? `${visible}…` : visible;
}

function formatClient(client) {
  return {
    id: client.id,
    name: client.name,
    businessUnit: client.businessUnit,
    cnpj: client.cnpj,
    clientInstance: client.clientInstance,
    provider: client.provider,
    instance: client.clientInstance || 'Nao informada',
    providerConfig: client.instance,
    hasCredential: Boolean(client.credential),
    credentialHint: maskCredentialHint(client.credential),
    multiProviderTenantId: client.multiProviderTenantId,
    hasMultiProviderCredential: Boolean(client.multiProviderApiKey),
    alpha7Port: client.alpha7Port,
    alpha7Database: client.alpha7Database,
    alpha7User: client.alpha7User,
    alpha7Schema: client.alpha7Schema,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export async function listClients({ page = 1, limit = 50, search = '' } = {}) {
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.max(1, Math.min(100, Number(limit) || 50));
  const skip = (pageNumber - 1) * limitNumber;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { businessUnit: { contains: search, mode: 'insensitive' } },
          { cnpj: { contains: search, mode: 'insensitive' } },
          { clientInstance: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, totalItems] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limitNumber,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    data: data.map(formatClient),
    meta: {
      page: pageNumber,
      limit: limitNumber,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limitNumber)),
    },
  };
}

export async function getClient(id) {
  const client = await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!client) {
    throw new Error('Cliente nao encontrado.');
  }

  return formatClient(client);
}

export async function getClientWithCredential(id) {
  const client = await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!client) {
    throw new Error('Cliente nao encontrado.');
  }

  return client;
}

export async function getClientMultiProviderApiKey(id, username) {
  const client = await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!client) {
    throw new Error('Cliente nao encontrado.');
  }
  if (!client.multiProviderApiKey) {
    throw new Error('Este cliente ainda nao possui uma API key multi-provider.');
  }

  await createLogService(
    String(username || 'Sistema').trim() || 'Sistema',
    `Consultou a API key multi-provider do cliente ${client.name}`,
    client.name,
  );

  return { apiKey: client.multiProviderApiKey };
}

export async function setupClientMultiProvider(id, username) {
  const clientId = Number(id);
  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) throw new Error('Cliente nao encontrado.');
  if (existing.provider === 'file') {
    const error = new Error('O provedor Arquivo nao utiliza integracao multi-provider.');
    error.statusCode = 400;
    throw error;
  }
  if (existing.multiProviderTenantId || existing.multiProviderApiKey) return formatClient(existing);

  const multiProvider = await createMultiProviderClient(existing);
  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      multiProviderTenantId: multiProvider.tenantId,
      multiProviderApiKey: multiProvider.apiKey,
    },
  });

  await createLogService(
    String(username || 'Sistema').trim() || 'Sistema',
    `Realizou o setup multi-provider do cliente ${updated.name}`,
    updated.name,
  );

  return formatClient(updated);
}

export async function createClient(payload) {
  const requestedBy = String(payload.username || 'Sistema').trim() || 'Sistema';
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('Informe o nome do cliente.');
  }

  const provider = PROVIDERS.has(payload.provider) ? payload.provider : null;
  if (!provider) {
    throw new Error('Informe um provedor valido (api, file ou alpha7).');
  }

  const rawInstance = String(payload.instance || '').trim();
  const clientInstance = String(payload.clientInstance || '').trim();
  if (!clientInstance) {
    throw new Error('Informe a instancia de identificacao do cliente.');
  }
  const instance = provider === 'api' ? DEFAULT_TRIER_API_URL : rawInstance;
  if (provider !== 'api' && !instance) {
    throw new Error('Informe a configuracao tecnica do provedor.');
  }

  if (provider === 'alpha7') {
    const alpha7Database = String(payload.alpha7Database || '').trim();
    const alpha7User = String(payload.alpha7User || '').trim();
    const alpha7Password = String(payload.credential || '').trim();
    if (!alpha7Database || !alpha7User || !alpha7Password) {
      throw new Error('Informe database, usuario e senha quando o provedor for Alpha 7.');
    }
  }

  const existing = await prisma.client.findUnique({ where: { name } });
  if (existing) {
    throw new Error('Ja existe um cliente cadastrado com esse nome.');
  }

  const sourceCredential = String(payload.credential || '').trim() || null;
  const multiProvider = await createMultiProviderClient({
    name,
    provider,
    instance,
    credential: sourceCredential,
    alpha7Port: provider === 'alpha7' ? Number(payload.alpha7Port) || 5432 : null,
    alpha7Database: provider === 'alpha7' ? String(payload.alpha7Database || '').trim() : null,
    alpha7User: provider === 'alpha7' ? String(payload.alpha7User || '').trim() : null,
  });

  const client = await prisma.client.create({
    data: {
      name,
      businessUnit: String(payload.businessUnit || '').trim() || null,
      cnpj: String(payload.cnpj || '').trim() || null,
      clientInstance,
      provider,
      instance,
      credential: sourceCredential,
      multiProviderTenantId: multiProvider?.tenantId || null,
      multiProviderApiKey: multiProvider?.apiKey || null,
      alpha7Port: provider === 'alpha7' ? Number(payload.alpha7Port) || 5432 : null,
      alpha7Database: provider === 'alpha7' ? String(payload.alpha7Database || '').trim() : null,
      alpha7User: provider === 'alpha7' ? String(payload.alpha7User || '').trim() : null,
      alpha7Schema:
        provider === 'alpha7' ? String(payload.alpha7Schema || 'public').trim() || 'public' : null,
    },
  });

  await createLogService(
    requestedBy,
    `Cadastrou cliente ${client.name} no modulo de Subidas Banco Unico`,
    client.name,
  );

  return formatClient(client);
}

export async function updateClient(id, payload) {
  const clientId = Number(id);
  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) {
    throw new Error('Cliente nao encontrado.');
  }

  const data = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw new Error('Informe o nome do cliente.');
    if (name !== existing.name) {
      const dup = await prisma.client.findUnique({ where: { name } });
      if (dup) throw new Error('Ja existe um cliente cadastrado com esse nome.');
    }
    data.name = name;
  }

  if (payload.provider !== undefined) {
    const provider = PROVIDERS.has(payload.provider) ? payload.provider : null;
    if (!provider) throw new Error('Informe um provedor valido (api, file ou alpha7).');
    data.provider = provider;
  }

  const provider = data.provider || existing.provider;

  if (payload.businessUnit !== undefined) {
    data.businessUnit = String(payload.businessUnit).trim() || null;
  }
  if (payload.cnpj !== undefined) {
    data.cnpj = String(payload.cnpj).trim() || null;
  }
  if (payload.clientInstance !== undefined) {
    const clientInstance = String(payload.clientInstance).trim();
    if (!clientInstance) {
      throw new Error('Informe a instancia de identificacao do cliente.');
    }
    data.clientInstance = clientInstance;
  }
  if (payload.instance !== undefined) {
    const instance = String(payload.instance).trim();
    if (provider !== 'api' && !instance) {
      throw new Error('Informe a configuracao tecnica do provedor.');
    }
    data.instance = provider === 'api' ? DEFAULT_TRIER_API_URL : instance;
  } else if (data.provider === 'api') {
    data.instance = DEFAULT_TRIER_API_URL;
  }
  if (payload.credential !== undefined) {
    data.credential = String(payload.credential).trim() || null;
  }

  if (provider === 'alpha7') {
    if (payload.alpha7Port !== undefined) data.alpha7Port = Number(payload.alpha7Port) || 5432;
    if (payload.alpha7Database !== undefined) data.alpha7Database = String(payload.alpha7Database).trim();
    if (payload.alpha7User !== undefined) data.alpha7User = String(payload.alpha7User).trim();
    if (payload.alpha7Schema !== undefined) {
      data.alpha7Schema = String(payload.alpha7Schema).trim() || 'public';
    }
  } else {
    data.alpha7Port = null;
    data.alpha7Database = null;
    data.alpha7User = null;
    data.alpha7Schema = null;
  }

  if (Object.keys(data).length === 0) {
    return formatClient(existing);
  }

  const updated = await prisma.client.update({ where: { id: clientId }, data });

  const requestedBy = String(payload.username || 'Sistema').trim() || 'Sistema';
  await createLogService(
    requestedBy,
    `Atualizou cliente ${updated.name} no modulo de Subidas Banco Unico`,
    updated.name,
  );

  return formatClient(updated);
}

export async function deleteClient(id, username) {
  const clientId = Number(id);
  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) {
    throw new Error('Cliente nao encontrado.');
  }

  const jobCount = await prisma.bancoUnicoImportJob.count({ where: { clientId } });
  if (jobCount > 0) {
    throw new Error('Nao e possivel excluir um cliente que possui importacoes associadas.');
  }

  await deleteMultiProviderClient(existing.multiProviderTenantId);

  await prisma.client.delete({ where: { id: clientId } });

  const requestedBy = String(username || 'Sistema').trim() || 'Sistema';
  await createLogService(
    requestedBy,
    `Excluiu cliente ${existing.name} do modulo de Subidas Banco Unico`,
    existing.name,
  );
}
