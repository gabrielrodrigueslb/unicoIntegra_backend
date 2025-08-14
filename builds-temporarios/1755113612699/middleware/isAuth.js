const access = require('../data/access_key.json');

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader || `${authHeader}` !== `${access.key}`) {
    const error = new Error('Não autenticado ou chave inválida.');
    error.statusCode = 401;
    throw error;
  }
  console.log('Autenticado com sucesso!');
  next();
};