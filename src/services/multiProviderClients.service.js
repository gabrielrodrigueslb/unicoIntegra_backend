import axios from 'axios';

import { env } from '../config/env.js';

function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function tenantDatabaseName(name) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45);

  if (!slug) {
    throw createError('Nome do cliente invalido para provisionar o banco Trier.', 400);
  }

  return `cliente_${slug}_cache`;
}

function requireMultiProviderConfiguration(provider) {
  if (!env.MULTIPROVIDER_BASE_URL || !env.MULTIPROVIDER_ADMIN_API_KEY) {
    throw createError('A integracao multi-provider nao esta configurada no servidor.', 503);
  }

  // Only Trier provisions a tenant cache DB on our shared Postgres. Vetor is
  // a pure REST API integration with no database of its own.
  if (provider === 'api') {
    const missing = [
      ['MULTIPROVIDER_TENANT_DB_HOST', env.MULTIPROVIDER_TENANT_DB_HOST],
      ['MULTIPROVIDER_TENANT_DB_USER', env.MULTIPROVIDER_TENANT_DB_USER],
      ['MULTIPROVIDER_TENANT_DB_PASSWORD', env.MULTIPROVIDER_TENANT_DB_PASSWORD],
    ].find(([, value]) => !value);

    if (missing) {
      throw createError(`A configuracao ${missing[0]} e obrigatoria para Trier.`, 503);
    }
  }
}

export function buildMultiProviderClientRequest(client) {
  requireMultiProviderConfiguration(client.provider);

  if (client.provider === 'alpha7') {
    return {
      path: '/api/admin/clientes/alpha7',
      body: {
        name: client.name,
        host: client.instance,
        port: client.alpha7Port || 5432,
        database: client.alpha7Database,
        user: client.alpha7User,
        password: client.credential,
        ssl: false,
      },
    };
  }

  if (client.provider === 'api') {
    if (!client.credential) {
      throw createError('Informe o token Trier para criar a integracao.', 400);
    }

    return {
      path: '/api/admin/clientes/trier',
      body: {
        name: client.name,
        trierToken: client.credential,
        host: env.MULTIPROVIDER_TENANT_DB_HOST,
        port: env.MULTIPROVIDER_TENANT_DB_PORT,
        database: tenantDatabaseName(client.name),
        user: env.MULTIPROVIDER_TENANT_DB_USER,
        password: env.MULTIPROVIDER_TENANT_DB_PASSWORD,
        ssl: env.MULTIPROVIDER_TENANT_DB_SSL,
        autoSync: true,
        autoSyncMode: 'bootstrap',
      },
    };
  }

  if (client.provider === 'vetor') {
    if (!client.credential) throw createError('Informe o token Vetor para criar a integracao.', 400);
    return {
      path: '/api/admin/clientes/vetor',
      body: {
        name: client.name,
        vetorToken: client.credential,
        unidade: client.instance,
        autoSync: false,
      },
    };
  }

  return null;
}

export async function createMultiProviderClient(client) {
  if (client.provider === 'file') return null;

  const request = buildMultiProviderClientRequest(client);

  try {
    const response = await axios.post(
      `${env.MULTIPROVIDER_BASE_URL.replace(/\/+$/, '')}${request.path}`,
      request.body,
      {
        headers: { 'x-api-key': env.MULTIPROVIDER_ADMIN_API_KEY },
        timeout: 30000,
      },
    );
    const tenantId = Number(response.data?.instancia?.id);
    const apiKey = String(response.data?.apiKey || '').trim();

    if (!Number.isInteger(tenantId) || !apiKey) {
      throw createError('A API multi-provider nao retornou a credencial do cliente.', 502);
    }

    return { tenantId, apiKey };
  } catch (error) {
    if (error.statusCode) throw error;

    const statusCode = error.response?.status;
    const message = error.response?.data?.message || error.message;
    throw createError(`Falha ao criar o cliente no multi-provider: ${message}`, statusCode || 502);
  }
}

export async function deleteMultiProviderClient(tenantId) {
  if (!tenantId) return;

  requireMultiProviderConfiguration('alpha7');

  try {
    await axios.delete(
      `${env.MULTIPROVIDER_BASE_URL.replace(/\/+$/, '')}/api/admin/clientes/${tenantId}`,
      {
        headers: { 'x-api-key': env.MULTIPROVIDER_ADMIN_API_KEY },
        timeout: 30000,
      },
    );
  } catch (error) {
    const statusCode = error.response?.status;
    const message = error.response?.data?.message || error.message;
    throw createError(`Falha ao excluir o cliente no multi-provider: ${message}`, statusCode || 502);
  }
}
