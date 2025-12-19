import { Router } from 'express';
import { postCreateNews, getLatestNews } from '../controllers/news.controller.js';

const router = Router();

// POST /api/news/create - Para criar (via Postman)
router.post('/create', postCreateNews);

// GET /api/news/latest - Para o Frontend
router.get('/latest', getLatestNews);

export default router;