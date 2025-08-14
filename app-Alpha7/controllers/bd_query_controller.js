const { validationResult } = require("express-validator");
const dbConfig = require("../data/db-config.json");
// const { Client } = require("pg");
const { Pool } = require("pg");

let dbConnection;
let poolConnection;

const connectDB = async (consulta) => {

    poolConnection = new Pool(dbConfig.db);
    //new Client(dbConfig.db);
    dbConnection = await poolConnection.connect()
    .catch(err => {
        console.log("Um erro ocorreu durante a conexão. Verifique se o servidor do Banco de Dados está ativo.")
        console.log(err.message, err.stack);
        const error = new Error(`${err.message}`);
        error.statusCode = 502;
        throw error
    });
};

const getOrcamento = async (req, res, next) => {

    const ref_id = req.body.id;
    const consulta = req.body.consulta;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Por favor, realize a consulta com dados válidos.");
        return res
            .status(422)
            .json({
                errorMessage:
                    "Por favor, realize a consulta com dados válidos.",
            });
    }

    if (
        dbConfig.db &&
        dbConfig.db.host.length > 1 &&
        dbConfig.db.user.length > 1 &&
        dbConfig.db.password.length > 1
    ) {
        await connectDB()
        .then(() => console.log("Banco de Dados conectado"))
        .catch(err => console.log('---------'))
        
    } else {
        console.log(
            "Insira os dados de conexão do Banco de Dados no arquivo de configuração."
        );
        return res
            .status(422)
            .json({
                errorMessage:
                    "Insira os dados de conexão do Banco de Dados no arquivo de configuração.",
            });
    }

    try {

        const result = await searchQuery(consulta);

        if (result.sucesso == false) {
            return res.status(500).json({
                errorMessage: result.message,
                id: ref_id,
            });
        }

        dbConnection.release();

        console.log(result.message);

        res.status(200).json({
            message: result.message,
            id: ref_id,
            itens: result.data,
            valorTotal: result.orcvalortotal,
        });

    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

const searchQuery = async (consulta) => {
    if (
        consulta.indexOf("INSERT") != -1 ||
        consulta.indexOf("DELETE") != -1 ||
        consulta.indexOf("PATCH") != -1 ||
        consulta.indexOf("UPDATE") != -1
    ) {
        return {
            sucesso: false,
            message: "Somente operação de leitura (SELECT) autorizada!",
        };
    }

    const result = await dbConnection
        .query(consulta)
        .then((data) => {
            console.log("Realizando pesquisa...");
            // console.log(data.rows);
            return {
                sucesso: true,
                message: "Consulta realizada com sucesso!",
                data: data.rows,
            };
        })
        .catch((err) => {
            let message;
            if (!err.message) {
                message =
                    "1- Verifique se digitou os dados corretamente. 2- Verifique se o servidor do Banco de Dados está ativo.";
            }
            return {
                sucesso: false,
                message: `Um erro ocorreu durante a consulta. ${
                    err.message || message
                }`,
            };
        });

    return result;
};

module.exports = { getOrcamento };
