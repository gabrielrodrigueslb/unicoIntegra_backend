import { Router } from 'express';

import * as aiController from '../controllers/ia.controller.js';

const router = Router();

router.options('/create-ai', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});

router.post('/create-ai', aiController.createAiController);
export default router;
