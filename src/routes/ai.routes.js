import { Router } from 'express';

import * as aiController from '../controllers/ia.controller.js';

const router = Router();

router.options('/create-ai/alpha', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});

router.options('/create-ai/vannon', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});
router.options('/create-ai', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});

router.post('/create-ai/alpha', aiController.createAiAlphaController);
router.post('/create-ai/vannon', aiController.createAiVannonController);

router.post('/create-ai', aiController.createAiController);
router.get('/versions', aiController.listAiVersionsController);
router.get('/templates', aiController.listAiTemplatesController);
router.post('/templates/sync-current', aiController.syncAiTemplatesController);
export default router;
