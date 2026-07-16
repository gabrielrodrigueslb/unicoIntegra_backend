import { Router } from 'express';
import {
  createClientController,
  deleteClientController,
  getClientController,
  getClientMultiProviderApiKeyController,
  listClientsController,
  regenerateClientMultiProviderApiKeyController,
  setupClientMultiProviderController,
  updateClientController,
} from '../controllers/clients.controller.js';

const router = Router();

router.get('/', listClientsController);
router.post('/', createClientController);
router.post('/:id/multiprovider-setup', setupClientMultiProviderController);
router.post('/:id/multiprovider-regenerate-key', regenerateClientMultiProviderApiKeyController);
router.get('/:id/multiprovider-api-key', getClientMultiProviderApiKeyController);
router.get('/:id', getClientController);
router.put('/:id', updateClientController);
router.delete('/:id', deleteClientController);

export default router;
