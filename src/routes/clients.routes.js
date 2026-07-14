import { Router } from 'express';
import {
  createClientController,
  deleteClientController,
  getClientController,
  getClientMultiProviderApiKeyController,
  listClientsController,
  setupClientMultiProviderController,
  updateClientController,
} from '../controllers/clients.controller.js';

const router = Router();

router.get('/', listClientsController);
router.post('/', createClientController);
router.post('/:id/multiprovider-setup', setupClientMultiProviderController);
router.get('/:id/multiprovider-api-key', getClientMultiProviderApiKeyController);
router.get('/:id', getClientController);
router.put('/:id', updateClientController);
router.delete('/:id', deleteClientController);

export default router;
