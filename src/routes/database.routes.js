import { Router } from "express";
import { getDatabases, createDatabaseController } from "../controllers/database.controller.js";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware.js";



const router = Router()

router.get('/',apiKeyMiddleware, getDatabases);
router.post('/createDatabase',apiKeyMiddleware, createDatabaseController);

export default router