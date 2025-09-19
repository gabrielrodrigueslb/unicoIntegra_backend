import { Router } from "express";
import * as installingController from '../controllers/installing.controller.js'

const router = Router();

router.post('/integration', installingController.installingIntegrations);

export default router;