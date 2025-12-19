import { adminPool } from '../database/adminPool.js';

export async function ensureNewsTableExists() {
  try {
    // 1. Cria o schema 'sistema'
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS sistema;`);
    
    // 2. Cria a tabela 'news' dentro de 'sistema'
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS sistema.news (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'feature', 'update', 'maintenance', 'alert'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela de Novidades (sistema.news) verificada/criada com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao verificar/criar tabela de novidades:', error.message);
  }
}

export async function createNews(title, description, type) {
  try {
    const query = `
      INSERT INTO sistema.news (title, description, type)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [title, description, type];
    
    const { rows } = await adminPool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error('Erro ao criar novidade:', error);
    throw error;
  }
}

export async function listLatestNews() {
  try {
    const query = `
      SELECT * FROM sistema.news 
      ORDER BY created_at DESC 
      LIMIT 3;
    `;
    
    const { rows } = await adminPool.query(query);
    return rows;
  } catch (error) {
    console.error('Erro ao listar novidades:', error);
    throw error;
  }
}