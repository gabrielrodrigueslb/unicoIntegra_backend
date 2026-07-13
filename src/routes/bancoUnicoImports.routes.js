import { Router } from 'express';
import {
  cancelBancoUnicoImportJobController,
  createBancoUnicoImportJobController,
  deleteBancoUnicoImportJobController,
  getBancoUnicoImportJobController,
  listBancoUnicoImportEventsController,
  listBancoUnicoImportItemsController,
  listBancoUnicoImportJobsController,
  pauseBancoUnicoImportJobController,
  resumeBancoUnicoImportJobController,
  streamBancoUnicoImportController,
} from '../controllers/bancoUnicoImports.controller.js';

const router = Router();

router.get('/', listBancoUnicoImportJobsController);
router.post('/', createBancoUnicoImportJobController);
router.get('/:id', getBancoUnicoImportJobController);
router.get('/:id/stream', streamBancoUnicoImportController);
router.get('/:id/items', listBancoUnicoImportItemsController);
router.get('/:id/events', listBancoUnicoImportEventsController);
router.post('/:id/pause', pauseBancoUnicoImportJobController);
router.post('/:id/resume', resumeBancoUnicoImportJobController);
router.post('/:id/cancel', cancelBancoUnicoImportJobController);
router.delete('/:id', deleteBancoUnicoImportJobController);

export default router;
