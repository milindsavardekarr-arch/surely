// routes/auth.routes.ts
import { Router } from 'express';
import { signup, login, getMe, createBusinessAccount } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/business-accounts', authenticate, createBusinessAccount);

export default router;
