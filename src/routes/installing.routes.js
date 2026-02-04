import { Router } from "express";
import * as installingController from '../controllers/installing.controller.js'

const router = Router();

router.options('/integration', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});
router.post('/integration', installingController.installingIntegrations);

export default router;