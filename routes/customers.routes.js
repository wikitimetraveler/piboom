import { Router } from 'express';
import { listCustomers, addCustomer, updateCustomer } from '../controllers/customers.controller.js';

const router = Router();

router.get('/', listCustomers);
router.post('/', addCustomer);
router.put('/:id', updateCustomer);

export default router;

