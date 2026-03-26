import { Router } from 'express';
import { postVerifyUserPassword } from '../controllers/app-user-auth.controller.js';

const router = Router();
router.post('/verify-user-password', postVerifyUserPassword);
export default router;
