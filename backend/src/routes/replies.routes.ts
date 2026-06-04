import { Router } from 'express';
import { listReplies, approveReply, rejectReply, regenerateReply, retryReply } from '../controllers/replies.controller';
import { authenticate, requireBusinessAccount } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate, requireBusinessAccount);
router.get('/', listReplies);
router.post('/:id/approve', approveReply);
router.post('/:id/reject', rejectReply);
router.post('/:id/retry', retryReply);
router.post('/:id/regenerate', regenerateReply);

export default router;
