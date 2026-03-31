import { Router } from 'express';
import { generateTrierExtensionController } from '../controllers/extensions.controller.js';

const router = Router();

router.options('/trier/generate', (req, res) => {
  res.sendStatus(204);
});

router.post('/trier/generate', generateTrierExtensionController);

export default router;
