import { Router } from "express";
import {
  checkExtensionDatabaseStatusController,
  createDatabaseController,
  getDatabases,
  testDatabaseConnectionController,
} from "../controllers/database.controller.js";

const router = Router();

router.options('/createDatabase', (req, res) => {
  res.sendStatus(204);
});

router.options('/testConnection', (req, res) => {
  res.sendStatus(204);
});

router.options('/checkIntegrationStatus', (req, res) => {
  res.sendStatus(204);
});

router.get('/', getDatabases);
router.post('/createDatabase', createDatabaseController);
router.post('/testConnection', testDatabaseConnectionController);
router.post('/checkIntegrationStatus', checkExtensionDatabaseStatusController);

export default router;
