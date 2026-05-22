import { Router } from 'express';
import { postLogout, postVerifyUserPassword } from '../controllers/app-user-auth.controller.js';

const router = Router();
router.post('/verify-user-password', postVerifyUserPassword);
router.post('/logout', postLogout);
export default router;
