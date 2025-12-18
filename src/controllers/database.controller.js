import { listDatabases, createDatabase } from "../services/database.services.js";

export async function getDatabases(req, res){
    try{
        const {page, limit, search} = req.query;

        const result = await listDatabases(page, limit, search)
        
        return res.json(result);
    }catch(error){
        console.error(error)
        return res.status(500).json({error: 'Erro ao listar bancos'})
    }
}

export async function createDatabaseController(req, res){
    try {
        // CORREÇÃO: Pegar do body, não da query
        const { name } = req.body; 

        if (!name) {
            return res.status(400).json({ error: 'Nome do banco é obrigatório' });
        }

        const result = await createDatabase(name);
        
        return res.status(201).json(result);

    } catch(error) {
        console.error(error);
        const errorMessage = error.message || 'Erro ao criar banco';
        if (errorMessage.includes('já existe')) {
            return res.status(409).json({ error: errorMessage });
        }

        return res.status(500).json({ error: errorMessage });
    }
}