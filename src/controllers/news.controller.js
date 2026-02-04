import { createNews, listLatestNews } from '../services/news.services.js';

export async function postCreateNews(req, res) {
  try {
    const { title, description, type } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ error: 'Campos title, description e type são obrigatórios.' });
    }

    const news = await createNews(title, description, type);
    return res.status(201).json(news);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao criar novidade.' });
  }
}

export async function getLatestNews(req, res) {
  try {
    const news = await listLatestNews();
    return res.json(news);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar novidades.' });
  }
}