import { Router } from 'express';
import {
  postChatController,
  postChatStreamController,
} from '../controllers/chatController.js';

const router = Router();

router.post('/stream', postChatStreamController);
router.post('/', postChatController);

export default router;
