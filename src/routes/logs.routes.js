// src/routes/logs.routes.js
import { Router } from 'express';
import { getLogs } from '../controllers/logs.controller.js'; // Atenção ao .js se estiver usando node nativo

const router = Router();

// Rota GET para o frontend consumir
router.get('/logs', getLogs);

export default router;