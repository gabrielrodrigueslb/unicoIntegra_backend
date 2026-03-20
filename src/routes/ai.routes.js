import { Router } from 'express';

import * as aiController from '../controllers/ia.controller.js';

const router = Router();

router.options('/create-ai/alpha', (req, res) => {
  res.sendStatus(204);
});

router.options('/create-ai/vannon', (req, res) => {
  res.sendStatus(204);
});

router.options('/create-ai/vetor', (req, res) => {
  res.sendStatus(204);
});

router.options('/create-ai', (req, res) => {
  res.sendStatus(204);
});

router.post('/create-ai/alpha', aiController.createAiAlphaController);
router.post('/create-ai/vannon', aiController.createAiVannonController);
router.post('/create-ai/vetor', aiController.createAiVetorController);

router.post('/create-ai', aiController.createAiController);
router.get('/versions', aiController.listAiVersionsController);
router.get('/templates', aiController.listAiTemplatesController);
router.post('/templates/sync-current', aiController.syncAiTemplatesController);

export default router;
