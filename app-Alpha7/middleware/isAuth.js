const access = require('../data/access_key.json');

module.exports = (req, res, next) => {

    const authHeader = req.get('Authorization');

    if (!authHeader) {
        const error = new Error('Não autenticado.');
        error.statusCode = 401;
        throw error
    }

    if(`${authHeader}` !== `${access.key}`) {
        const error = new Error('Não autorizado. Chave de acesso inválida.');
        // console.log(error.message)
        error.statusCode = 401;
        throw error
    }

    console.log('Autenticado com sucesso!')

    next()
}