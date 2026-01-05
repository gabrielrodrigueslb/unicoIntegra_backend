import { adminPool } from '../database/adminPool.js';

function sanitizeDbName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') 
    .slice(0, 50);
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
