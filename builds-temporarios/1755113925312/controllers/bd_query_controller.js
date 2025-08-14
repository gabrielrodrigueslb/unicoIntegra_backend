const { validationResult } = require('express-validator');
const { Pool } = require('pg');
const dbConfig = require('../data/db-config.json'); // Simples assim

let pool;
if (dbConfig.db) {
  pool = new Pool(dbConfig.db);
  console.log('Pool de conexões com o banco de dados inicializado.');
} else {
  console.error('ERRO: Configurações do banco de dados incompletas.');
}

const getOrcamento = async (req, res, next) => {
  // ...toda a lógica da função continua igual...
  try {
    const result = await pool.query(req.body.consulta);
    res.status(200).json({ message: 'Consulta OK', id: req.body.id, itens: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOrcamento }; // Exportação em CommonJS