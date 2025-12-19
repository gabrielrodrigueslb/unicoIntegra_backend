import { Router } from "express";
import { getDatabases, createDatabaseController } from "../controllers/database.controller.js";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware.js";



const router = Router()

router.options('/createDatabase', (req, res) => {
  // Apenas responda 204 "No Content", que é o que o preflight espera.
  res.sendStatus(204);
});

router.get('/', getDatabases);
router.post('/createDatabase', createDatabaseController);

export default router