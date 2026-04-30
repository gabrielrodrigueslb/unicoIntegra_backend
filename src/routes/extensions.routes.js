import { Router } from 'express';
import {
  generateInovaFarmaExtensionController,
  generateTrierExtensionController,
} from '../controllers/extensions.controller.js';

const router = Router();

router.options('/trier/generate', (req, res) => {
  res.sendStatus(204);
});

router.post('/trier/generate', generateTrierExtensionController);
router.options('/inova-farma/generate', (req, res) => {
  res.sendStatus(204);
});

router.post('/inova-farma/generate', generateInovaFarmaExtensionController);

export default router;
