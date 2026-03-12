import { Client } from 'pg';

import { adminPool } from '../database/adminPool.js';

const EXTENSION_STATUS_SCHEMA = 'public';
const EXTENSION_STATUS_TABLE = 'out_embalagem';

function sanitizeDbName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') 
    .slice(0, 50);
}

function createDatabaseError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeConnectionConfig(config) {
  const host = config.host?.trim();
  const database = config.database?.trim();
  const user = config.user?.trim();
  const password = typeof config.password === 'string' ? config.password : '';
  const port = Number(config.port);
  const ssl = Boolean(config.ssl);

  if (!host) {
    throw createDatabaseError('Informe o host do banco.', 400);
  }

  if (!database) {
    throw createDatabaseError('Informe o nome do banco.', 400);
  }

  if (!user) {
    throw createDatabaseError('Informe o usuário do banco.', 400);
  }

  if (!password) {
    throw createDatabaseError('Informe a senha do banco.', 400);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw createDatabaseError('Informe uma porta válida entre 1 e 65535.', 400);
  }

  return {
    host,
    database,
    user,
    password,
    port,
    ssl,
  };
}

function normalizeManagedDatabaseName(databaseName) {
  const normalizedName = databaseName?.trim();

  if (!normalizedName) {
    throw createDatabaseError('Informe o banco que deseja verificar.', 400);
  }

  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(normalizedName)) {
    throw createDatabaseError('Nome do banco informado e invalido.', 400);
  }

  return normalizedName;
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw createDatabaseError('Identificador invalido para consulta.', 400);
  }

  return `"${identifier}"`;
}

function mapConnectionError(error) {
  const knownErrors = {
    ENOTFOUND: 'Host não encontrado. Verifique o endereço informado.',
    ECONNREFUSED: 'Conexão recusada. Verifique host, porta e firewall.',
    ETIMEDOUT: 'Tempo esgotado ao tentar conectar ao banco.',
    '28P01': 'Usuário ou senha inválidos.',
    '3D000': 'Banco de dados não encontrado.',
    '23505': 'Conexão recusada pelo servidor.',
    '57P03': 'Servidor indisponível no momento.',
  };

  const message =
    knownErrors[error.code] ||
    error.message ||
    'Não foi possível conectar ao banco informado.';

  return createDatabaseError(message, error.statusCode || 400);
}

function mapManagedDatabaseError(error, databaseName) {
  if (error.code === '42501') {
    return createDatabaseError(
      `O usuario configurado nao tem permissao para consultar o banco ${databaseName}.`,
      403,
    );
  }

  return mapConnectionError(error);
}

function createManagedDatabaseClient(databaseName) {
  return new Client({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    database: databaseName,
    port: Number(process.env.DBPORT) || 5432,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 8000,
  });
}

export async function listDatabases(page = 1, limit = 9, search = '') {
  try {
    const offset = (page - 1) * limit;

    let queryBase = `
      FROM pg_database
      WHERE datistemplate = false
      AND datname NOT IN ('postgres')
      `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      queryBase += `AND datname ILIKE $${params.length}`;
    }

    //Buscar os dados paginados
    const dataParams = [...params];

    dataParams.push(limit);
    const limitIndex = dataParams.length;

    dataParams.push(offset);
    const offsetIndex = dataParams.length;

    const dataQuery = `
            SELECT datname, pg_size_pretty(pg_database_size(datname)) as size ${queryBase}
            ORDER BY datname ASC
            LIMIT $${limitIndex} OFFSET $${offsetIndex}
            `;
    const { rows: dataRows } = await adminPool.query(dataQuery, dataParams);

    //Contar o total de páginas
    const countQuery = `SELECT COUNT(*) as total ${queryBase}`;
    const { rows: countRows } = await adminPool.query(countQuery, params);

    const totalItems = parseInt(countRows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: dataRows.map((row) => ({
        name: row.datname,
        size: row.size,
      })),
      meta: {
        page: Number(page),
        limit: Number(limit),
        totalItems,
        totalPages,
      },
    };
  } catch (error) {
    console.error('Falha ao listar os databases:', error.message);
    throw error;
  }
}

export async function createDatabase(name) {
  const dbName = sanitizeDbName(name);
  
  if (!dbName || dbName.length < 3) {
      throw new Error("Nome do banco inválido ou muito curto.");
  }

  try {
    // Executa a query
    await adminPool.query(`
      CREATE DATABASE ${dbName}
      WITH ENCODING 'UTF8'
    `);

    

    // Retorna apenas o objeto de sucesso
    return { database: dbName, message: 'Criado com sucesso' };

  } catch (error) {
    // Lança o erro para o controller tratar
    if (error.code === '42P04') {
      throw new Error('Banco de dados já existe');
    }
    // Repassa o erro original se for outro tipo
    throw error; 
  }
}

export async function testDatabaseConnection(config) {
  const normalizedConfig = normalizeConnectionConfig(config);
  const client = new Client({
    host: normalizedConfig.host,
    database: normalizedConfig.database,
    user: normalizedConfig.user,
    password: normalizedConfig.password,
    port: normalizedConfig.port,
    ssl: normalizedConfig.ssl,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
  });
  const startedAt = Date.now();

  try {
    await client.connect();

    const { rows } = await client.query(
      'SELECT current_database() AS database, current_user AS user_name',
    );

    return {
      success: true,
      message: 'Conexão realizada com sucesso.',
      latencyMs: Date.now() - startedAt,
      details: {
        host: normalizedConfig.host,
        port: normalizedConfig.port,
        database: rows[0]?.database || normalizedConfig.database,
        user: rows[0]?.user_name || normalizedConfig.user,
        ssl: normalizedConfig.ssl,
      },
    };
  } catch (error) {
    throw mapConnectionError(error);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function checkExtensionDatabaseStatus(databaseName) {
  const normalizedDatabaseName = normalizeManagedDatabaseName(databaseName);
  const client = createManagedDatabaseClient(normalizedDatabaseName);
  const startedAt = Date.now();
  const qualifiedTableName = `${quoteIdentifier(EXTENSION_STATUS_SCHEMA)}.${quoteIdentifier(
    EXTENSION_STATUS_TABLE,
  )}`;

  try {
    await client.connect();

    const { rows: metadataRows } = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1
            AND table_name = $2
        ) AS exists
      `,
      [EXTENSION_STATUS_SCHEMA, EXTENSION_STATUS_TABLE],
    );

    const tableExists = metadataRows[0]?.exists === true;

    if (!tableExists) {
      return {
        success: true,
        message:
          'A tabela out_embalagem nao foi encontrada neste banco. A integracao ainda nao pode prosseguir.',
        latencyMs: Date.now() - startedAt,
        database: normalizedDatabaseName,
        requirements: {
          schema: EXTENSION_STATUS_SCHEMA,
          table: EXTENSION_STATUS_TABLE,
          tableExists: false,
          hasProducts: false,
          productCount: 0,
        },
        readyForIntegration: false,
      };
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::bigint AS total FROM ${qualifiedTableName}`,
    );
    const productCount = Number(countRows[0]?.total || 0);
    const hasProducts = productCount > 0;

    return {
      success: true,
      message: hasProducts
        ? `A tabela out_embalagem foi encontrada com ${productCount} produto(s) cadastrado(s).`
        : 'A tabela out_embalagem existe, mas ainda nao possui produtos cadastrados.',
      latencyMs: Date.now() - startedAt,
      database: normalizedDatabaseName,
      requirements: {
        schema: EXTENSION_STATUS_SCHEMA,
        table: EXTENSION_STATUS_TABLE,
        tableExists: true,
        hasProducts,
        productCount,
      },
      readyForIntegration: hasProducts,
    };
  } catch (error) {
    throw mapManagedDatabaseError(error, normalizedDatabaseName);
  } finally {
    await client.end().catch(() => {});
  }
}
