import { Router } from 'express';
import { postChatController } from '../controllers/chatController.js';

const router = Router();

router.post('/', postChatController);

export default router;
