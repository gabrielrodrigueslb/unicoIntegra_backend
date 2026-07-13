import { Router } from 'express';
import {
  createClientController,
  deleteClientController,
  getClientController,
  listClientsController,
  updateClientController,
} from '../controllers/clients.controller.js';

const router = Router();

router.get('/', listClientsController);
router.post('/', createClientController);
router.get('/:id', getClientController);
router.put('/:id', updateClientController);
router.delete('/:id', deleteClientController);

export default router;
