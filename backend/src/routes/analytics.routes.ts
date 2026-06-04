import { Router } from 'express';
import { getDashboardStats, getContactEngagement } from '../controllers/analytics.controller';
import { authenticate, requireBusinessAccount } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate, requireBusinessAccount);
router.get('/dashboard', getDashboardStats);
router.get('/contacts/engagement', getContactEngagement);

export default router;
